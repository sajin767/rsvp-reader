package com.rsvpreader.app;

import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin implements TextToSpeech.OnInitListener {
    private static class AudioSegment {
        String id;
        int startWord;
        int endWord;
        String text;
        int pauseMs;
        File file;
    }

    private TextToSpeech textToSpeech;
    private boolean ready = false;
    private boolean failed = false;
    private final ExecutorService synthesisExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ArrayList<AudioSegment> segments = new ArrayList<>();
    private final Set<String> generatedSegmentIds = new HashSet<>();
    private final Set<String> completedUtteranceIds = new HashSet<>();
    private MediaPlayer mediaPlayer;
    private String activeBookId = "";
    private String activeContentHash = "";
    private File activeAudioDir;
    private int currentSegmentIndex = 0;
    private int generatedSegments = 0;
    private int totalSegments = 0;
    private int currentWord = 0;
    private float playbackRate = 1.0f;
    private boolean preparing = false;
    private boolean playing = false;
    private boolean paused = false;
    private boolean shouldAutoPlay = false;
    private boolean externalAudioMode = false;

    @Override
    public void load() {
        if (textToSpeech == null) {
            textToSpeech = new TextToSpeech(getContext(), this);
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && textToSpeech != null) {
            int languageStatus = textToSpeech.setLanguage(Locale.getDefault());
            ready = languageStatus != TextToSpeech.LANG_MISSING_DATA
                && languageStatus != TextToSpeech.LANG_NOT_SUPPORTED;
            failed = !ready;
            textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    // No-op.
                }

                @Override
                public void onDone(String utteranceId) {
                    markSynthesisComplete(utteranceId);
                }

                @Override
                public void onError(String utteranceId) {
                    markSynthesisComplete(utteranceId);
                }
            });
        } else {
            ready = false;
            failed = true;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", ready && !failed);
        call.resolve(result);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        float rate = call.getDouble("rate", 1.0).floatValue();
        float pitch = call.getDouble("pitch", 1.0).floatValue();

        if (text.isEmpty()) {
            call.reject("Text is required");
            return;
        }

        if (!ensureReady(call)) {
            return;
        }

        stopAudioInternal();
        textToSpeech.setSpeechRate(rate);
        textToSpeech.setPitch(pitch);
        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "live-" + System.currentTimeMillis());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void prepareBookAudio(PluginCall call) {
        if (!ensureReady(call)) {
            return;
        }

        String bookId = call.getString("bookId", "").trim();
        String contentHash = call.getString("contentHash", "").trim();
        JSArray segmentArray = call.getArray("segments");
        if (bookId.isEmpty() || contentHash.isEmpty() || segmentArray == null) {
            call.reject("Book id, content hash, and segments are required");
            return;
        }

        stopAudioInternal();
        activeBookId = bookId;
        activeContentHash = contentHash;
        externalAudioMode = false;
        activeAudioDir = new File(getContext().getCacheDir(), "rsvp-audio/" + sanitize(bookId) + "-" + sanitize(contentHash));
        if (!activeAudioDir.exists()) {
            activeAudioDir.mkdirs();
        }

        segments.clear();
        generatedSegmentIds.clear();
        completedUtteranceIds.clear();
        generatedSegments = 0;
        totalSegments = segmentArray.length();
        currentSegmentIndex = 0;
        currentWord = 0;
        preparing = totalSegments > 0;
        playing = false;
        paused = false;
        shouldAutoPlay = false;

        try {
            for (int index = 0; index < segmentArray.length(); index += 1) {
                JSONObject item = segmentArray.getJSONObject(index);
                AudioSegment segment = new AudioSegment();
                segment.id = item.optString("id", "segment-" + index);
                segment.startWord = item.optInt("startWord", 0);
                segment.endWord = item.optInt("endWord", segment.startWord);
                segment.text = item.optString("text", "").trim();
                segment.pauseMs = item.optInt("pauseMs", 0);
                segment.file = new File(activeAudioDir, sanitize(segment.id) + ".wav");
                segments.add(segment);
                if (segment.file.exists() && segment.file.length() > 0) {
                    generatedSegmentIds.add(segment.id);
                    generatedSegments += 1;
                }
            }
        } catch (JSONException exception) {
            call.reject("Invalid audio segments");
            return;
        }

        playbackRate = rateFromWpm(call.getDouble("wpm", 300.0).floatValue());
        synthesisExecutor.execute(this::generateMissingSegments);
        call.resolve();
    }

    @PluginMethod
    public void prepareDeepgramAudio(PluginCall call) {
        String apiKey = call.getString("apiKey", "").trim();
        String bookId = call.getString("bookId", "").trim();
        String contentHash = call.getString("contentHash", "").trim();
        JSArray segmentArray = call.getArray("segments");
        if (apiKey.isEmpty() || bookId.isEmpty() || contentHash.isEmpty() || segmentArray == null) {
            call.reject("Deepgram key, book id, content hash, and segments are required");
            return;
        }

        stopAudioInternal();
        activeBookId = bookId;
        activeContentHash = contentHash;
        externalAudioMode = true;
        activeAudioDir = new File(getContext().getCacheDir(), "deepgram-audio/" + sanitize(bookId) + "-" + sanitize(contentHash));
        if (!activeAudioDir.exists()) {
            activeAudioDir.mkdirs();
        }

        segments.clear();
        generatedSegmentIds.clear();
        completedUtteranceIds.clear();
        generatedSegments = 0;
        totalSegments = segmentArray.length();
        currentSegmentIndex = 0;
        currentWord = 0;
        preparing = totalSegments > 0;
        playing = false;
        paused = false;
        shouldAutoPlay = false;

        try {
            for (int index = 0; index < segmentArray.length(); index += 1) {
                JSONObject item = segmentArray.getJSONObject(index);
                AudioSegment segment = new AudioSegment();
                segment.id = item.optString("id", "segment-" + index);
                segment.startWord = item.optInt("startWord", 0);
                segment.endWord = item.optInt("endWord", segment.startWord);
                segment.text = item.optString("text", "").trim();
                segment.pauseMs = item.optInt("pauseMs", 0);
                segment.file = new File(activeAudioDir, sanitize(segment.id) + ".mp3");
                segments.add(segment);
                if (segment.file.exists() && segment.file.length() > 0) {
                    generatedSegmentIds.add(segment.id);
                    generatedSegments += 1;
                }
            }
        } catch (JSONException exception) {
            call.reject("Invalid Deepgram audio segments");
            return;
        }

        playbackRate = rateFromWpm(call.getDouble("wpm", 300.0).floatValue());
        synthesisExecutor.execute(() -> generateMissingDeepgramSegments(apiKey));
        call.resolve();
    }

    @PluginMethod
    public void playFromWord(PluginCall call) {
        String bookId = call.getString("bookId", "").trim();
        int wordIndex = call.getInt("wordIndex", 0);
        playbackRate = rateFromWpm(call.getDouble("wpm", 300.0).floatValue());

        if (!bookId.equals(activeBookId) || segments.isEmpty()) {
            call.reject("Audio is not prepared for this book");
            return;
        }

        currentSegmentIndex = findSegmentIndex(wordIndex);
        currentWord = wordIndex;
        shouldAutoPlay = true;
        paused = false;
        playCurrentSegmentWhenReady();
        call.resolve();
    }

    @PluginMethod
    public void pauseAudio(PluginCall call) {
        paused = true;
        shouldAutoPlay = false;
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
        }
        call.resolve();
    }

    @PluginMethod
    public void resumeAudio(PluginCall call) {
        paused = false;
        shouldAutoPlay = true;
        if (mediaPlayer != null) {
            mediaPlayer.start();
        } else {
            playCurrentSegmentWhenReady();
        }
        call.resolve();
    }

    @PluginMethod
    public void stopAudio(PluginCall call) {
        stopAudioInternal();
        call.resolve();
    }

    @PluginMethod
    public void seekAudio(PluginCall call) {
        int wordIndex = call.getInt("wordIndex", 0);
        playbackRate = rateFromWpm(call.getDouble("wpm", 300.0).floatValue());
        currentSegmentIndex = findSegmentIndex(wordIndex);
        currentWord = wordIndex;
        if (playing || shouldAutoPlay) {
            shouldAutoPlay = true;
            paused = false;
            playCurrentSegmentWhenReady();
        }
        call.resolve();
    }

    @PluginMethod
    public void setAudioWpm(PluginCall call) {
        playbackRate = rateFromWpm(call.getDouble("wpm", 300.0).floatValue());
        applyPlaybackRate();
        call.resolve();
    }

    @PluginMethod
    public void getAudioStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", externalAudioMode || (ready && !failed));
        result.put("preparing", preparing);
        result.put("ready", totalSegments > 0 && generatedSegments >= totalSegments);
        result.put("playing", playing && !paused);
        result.put("currentWord", currentWord);
        result.put("generatedSegments", generatedSegments);
        result.put("totalSegments", totalSegments);
        call.resolve(result);
    }

    private boolean ensureReady(PluginCall call) {
        if (textToSpeech == null) {
            textToSpeech = new TextToSpeech(getContext(), this);
        }

        if (!ready || failed || textToSpeech == null) {
            call.reject("Native TTS is not ready on this device");
            return false;
        }

        return true;
    }

    private void generateMissingSegments() {
        for (AudioSegment segment : new ArrayList<>(segments)) {
            if (segment.text.isEmpty()) {
                markSegmentGenerated(segment.id);
                continue;
            }

            if (segment.file.exists() && segment.file.length() > 0) {
                markSegmentGenerated(segment.id);
                continue;
            }

            synthesizeSegment(segment);
        }

        mainHandler.post(() -> {
            preparing = false;
            if (shouldAutoPlay && mediaPlayer == null) {
                playCurrentSegmentWhenReady();
            }
        });
    }

    private void generateMissingDeepgramSegments(String apiKey) {
        for (AudioSegment segment : new ArrayList<>(segments)) {
            if (segment.text.isEmpty()) {
                markSegmentGenerated(segment.id);
                continue;
            }

            if (segment.file.exists() && segment.file.length() > 0) {
                markSegmentGenerated(segment.id);
                continue;
            }

            downloadDeepgramSegment(apiKey, segment);
        }

        mainHandler.post(() -> {
            preparing = false;
            if (shouldAutoPlay && mediaPlayer == null) {
                playCurrentSegmentWhenReady();
            }
        });
    }

    private void downloadDeepgramSegment(String apiKey, AudioSegment segment) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Token " + apiKey);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "audio/mpeg");

            String body = "{\"text\":\"" + escapeJson(segment.text) + "\"}";
            try (OutputStream output = new BufferedOutputStream(connection.getOutputStream())) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                markSegmentGenerated(segment.id);
                return;
            }

            File tempFile = new File(segment.file.getParentFile(), segment.file.getName() + ".tmp");
            if (tempFile.exists()) {
                tempFile.delete();
            }

            try (
                BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                FileOutputStream output = new FileOutputStream(tempFile)
            ) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
            }

            if (tempFile.exists() && tempFile.length() > 0) {
                if (segment.file.exists()) {
                    segment.file.delete();
                }
                tempFile.renameTo(segment.file);
            }
            markSegmentGenerated(segment.id);
        } catch (IOException exception) {
            markSegmentGenerated(segment.id);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void synthesizeSegment(AudioSegment segment) {
        try {
            File tempFile = new File(segment.file.getParentFile(), segment.file.getName() + ".tmp");
            if (tempFile.exists()) {
                tempFile.delete();
            }
            FileOutputStream stream = new FileOutputStream(tempFile);
            stream.close();

            Bundle params = new Bundle();
            textToSpeech.setSpeechRate(1.0f);
            int result = textToSpeech.synthesizeToFile(segment.text, params, tempFile, segment.id);
            if (result != TextToSpeech.SUCCESS) {
                markSegmentGenerated(segment.id);
                return;
            }

            long startedAt = System.currentTimeMillis();
            while (!isSynthesisComplete(segment.id) && System.currentTimeMillis() - startedAt < 20000) {
                Thread.sleep(50);
            }

            if (tempFile.exists() && tempFile.length() > 0) {
                if (segment.file.exists()) {
                    segment.file.delete();
                }
                tempFile.renameTo(segment.file);
            }
            markSegmentGenerated(segment.id);
        } catch (IOException | InterruptedException exception) {
            markSegmentGenerated(segment.id);
        }
    }

    private synchronized void markSynthesisComplete(String segmentId) {
        completedUtteranceIds.add(segmentId);
    }

    private synchronized boolean isSynthesisComplete(String segmentId) {
        return completedUtteranceIds.contains(segmentId);
    }

    private synchronized void markSegmentGenerated(String segmentId) {
        if (generatedSegmentIds.add(segmentId)) {
            generatedSegments = Math.min(generatedSegmentIds.size(), totalSegments);
        }

        mainHandler.post(() -> {
            if (shouldAutoPlay && mediaPlayer == null) {
                playCurrentSegmentWhenReady();
            }
        });
    }

    private int findSegmentIndex(int wordIndex) {
        for (int index = 0; index < segments.size(); index += 1) {
            AudioSegment segment = segments.get(index);
            if (wordIndex >= segment.startWord && wordIndex <= segment.endWord) {
                return index;
            }
        }
        return Math.max(0, Math.min(currentSegmentIndex, Math.max(segments.size() - 1, 0)));
    }

    private void playCurrentSegmentWhenReady() {
        mainHandler.post(() -> {
            releaseMediaPlayer();
            if (!shouldAutoPlay || paused || currentSegmentIndex >= segments.size()) {
                playing = false;
                return;
            }

            AudioSegment segment = segments.get(currentSegmentIndex);
            currentWord = segment.startWord;
            if (!segment.file.exists() || segment.file.length() == 0) {
                playing = false;
                return;
            }

            try {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(segment.file.getAbsolutePath());
                mediaPlayer.setOnPreparedListener(player -> {
                    applyPlaybackRate();
                    playing = true;
                    player.start();
                });
                mediaPlayer.setOnCompletionListener(player -> {
                    currentSegmentIndex += 1;
                    releaseMediaPlayer();
                    if (!shouldAutoPlay || paused || currentSegmentIndex >= segments.size()) {
                        playing = false;
                        return;
                    }
                    mainHandler.postDelayed(this::playCurrentSegmentWhenReady, Math.max(segment.pauseMs, 0));
                });
                mediaPlayer.prepareAsync();
            } catch (IOException exception) {
                currentSegmentIndex += 1;
                playCurrentSegmentWhenReady();
            }
        });
    }

    private void applyPlaybackRate() {
        if (mediaPlayer == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }

        try {
            PlaybackParams params = mediaPlayer.getPlaybackParams();
            params.setSpeed(playbackRate);
            mediaPlayer.setPlaybackParams(params);
        } catch (IllegalStateException exception) {
            // MediaPlayer may not be prepared yet.
        }
    }

    private float rateFromWpm(float wpm) {
        return Math.max(0.6f, Math.min(2.0f, wpm / 300.0f));
    }

    private String sanitize(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String escapeJson(String value) {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }

    private void stopAudioInternal() {
        shouldAutoPlay = false;
        playing = false;
        paused = false;
        releaseMediaPlayer();
    }

    private void releaseMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
            } catch (IllegalStateException exception) {
                // Already stopped or not prepared.
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopAudioInternal();
        synthesisExecutor.shutdownNow();
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
    }
}
