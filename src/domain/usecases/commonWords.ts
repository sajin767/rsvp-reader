// Common English words - words in this list are "easy" and can be read faster
// These are the ~2000 most common English words
// Words NOT in this list are considered "difficult" and get more time

export const COMMON_WORDS = new Set([
  // Top 100 most common
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  
  // Common verbs
  'is', 'was', 'are', 'were', 'been', 'being', 'am',
  'has', 'had', 'having', 'does', 'did', 'doing',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
  'need', 'dare', 'ought', 'used',
  
  // Articles, prepositions, conjunctions
  'a', 'an', 'the', 'a', 'an',
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
  'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'whether', 'although', 'because', 'since', 'unless', 'until', 'while', 'whereas',
  
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'us', 'our', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'whose',
  'this', 'that', 'these', 'those',
  
  // Common adjectives
  'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other', 'old',
  'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young',
  'important', 'few', 'public', 'bad', 'same', 'able', 'best', 'better', 'sure',
  'free', 'true', 'full', 'special', 'easy', 'clear', 'hard', 'recent', 'certain',
  'personal', 'open', 'real', 'strong', 'possible', 'whole', 'digital', 'happy',
  
  // Common adverbs
  'very', 'really', 'actually', 'already', 'always', 'also', 'back', 'even', 'still',
  'ever', 'never', 'often', 'sometimes', 'usually', 'perhaps', 'maybe', 'well',
  'just', 'only', 'quite', 'rather', 'too', 'enough', 'almost', 'enough',
  'more', 'most', 'least', 'less', 'very',
  'here', 'there', 'now', 'then', 'when', 'where', 'how', 'why',
  'again', 'further', 'once', 'anywhere', 'somewhere', 'nowhere',
  'thus', 'hence', 'therefore', 'however', 'although', 'yet', 'still',
  
  // Numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'hundred', 'thousand', 'million', 'billion',
  'first', 'second', 'third', 'fourth', 'fifth', 'once', 'twice',
  
  // Days, months, time words
  'today', 'yesterday', 'tomorrow', 'morning', 'afternoon', 'evening', 'night',
  'week', 'month', 'year', 'day', 'hour', 'minute', 'second',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  
  // Common nouns
  'way', 'case', 'point', 'world', 'life', 'hand', 'part', 'place', 'thing', 'home',
  'man', 'woman', 'child', 'children', 'people', 'family', 'friend', 'face', 'head',
  'word', 'name', 'number', 'story', 'work', 'fact', 'group', 'company', 'system',
  'program', 'question', 'government', 'country', 'state', 'city', 'town', 'school',
  'student', 'teacher', 'book', 'eye', 'eyes', 'money', 'bit', 'share', 'area',
  'money', 'game', 'team', 'lot', 'thing', 'sort', 'kind', 'type', 'piece', 'view',
  'week', 'house', 'building', 'room', 'floor', 'street', 'road', 'line', 'side',
  'member', 'party', 'result', 'problem', 'thought', 'law', 'idea', 'phone',
  'car', 'bus', 'train', 'plane', 'ship', 'boat', 'road', 'air', 'water', 'fire',
  'food', 'meat', 'fish', 'bread', 'rice', 'egg', 'milk', 'salt', 'sugar',
  'tree', 'plant', 'flower', 'rose', 'grass', 'garden', 'forest', 'mountain', 'river',
  'sea', 'ocean', 'lake', 'rain', 'snow', 'wind', 'sun', 'moon', 'star', 'sky',
  'stone', 'rock', 'sand', 'gold', 'silver', 'iron', 'glass', 'paper', 'wood',
  'book', 'page', 'letter', 'word', 'story', 'song', 'music', 'art', 'color',
  'red', 'blue', 'green', 'yellow', 'white', 'black', 'dark', 'light',
  
  // Common misc
  'yes', 'no', 'not', 'ok', 'okay', 'please', 'thank', 'thanks', 'sorry',
  'mr', 'mrs', 'ms', 'dr', 'ms', 'miss',
  'etc', 'per', 'vs', 'ie', 'eg',
  'something', 'anything', 'nothing', 'everything', 'someone', 'anyone', 'no one',
  'everybody', 'anybody', 'nobody', 'somebody',
  'sometimes', 'somewhere', 'somehow', 'anyway', 'anyway',
  
  // Technology/Internet common
  'computer', 'phone', 'email', 'internet', 'web', 'site', 'page', 'link', 'click',
  'app', 'software', 'data', 'file', 'image', 'video', 'music',
  'social', 'media', 'news', 'blog', 'post', 'user', 'account',
  
  // Business common
  'job', 'work', 'career', 'office', 'client', 'customer', 'sale', 'cost', 'price',
  'market', 'sales', 'product', 'service', 'business', 'trade',
  
  // More common words
  'start', 'started', 'starting', 'stop', 'stopped', 'stopping',
  'run', 'running', 'ran', 'walk', 'walking', 'went', 'gone',
  'come', 'coming', 'came', 'make', 'making', 'made',
  'take', 'taking', 'took', 'taken', 'give', 'giving', 'gave', 'given',
  'get', 'getting', 'got', 'getting', 'go', 'going', 'went', 'gone',
  'see', 'seeing', 'saw', 'seen', 'look', 'looking', 'looked',
  'know', 'knew', 'known', 'think', 'thinking', 'thought',
  'want', 'wanted', 'wanting', 'need', 'needed', 'needing',
  'use', 'using', 'used', 'try', 'trying', 'tried',
  'find', 'found', 'tell', 'told', 'ask', 'asked',
  'feel', 'felt', 'become', 'became', 'leave', 'left',
  'put', 'keep', 'kept', 'let', 'begin', 'began', 'begun',
  'seem', 'seemed', 'help', 'show', 'showed', 'heard', 'play',
  'move', 'live', 'believe', 'hold', 'brought', 'bring',
  'happen', 'write', 'provide', 'sit', 'stand', 'lose', 'pay',
  'meet', 'include', 'continue', 'set', 'learn', 'change', 'lead',
  'understand', 'watch', 'follow', 'stop', 'create', 'speak', 'read',
  'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember',
  'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'die', 'send',
  'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'kill', 'remain',
]);

// Check if a word is "difficult" (should get more time)
export function isDifficultWord(word: string): boolean {
  if (!word || word.length === 0) return false;
  
  // Strip punctuation for checking
  const cleanWord = word.replace(/[^a-zA-Z]/g, '');
  if (cleanWord.length === 0) return false;
  
  // All uppercase or capitalized (likely a name)
  if (cleanWord[0] === cleanWord[0].toUpperCase() && 
      cleanWord.slice(1) !== cleanWord.slice(1).toLowerCase() &&
      cleanWord.length > 3) {
    return true;
  }
  
  // Very long words (>10 chars) are difficult
  if (cleanWord.length > 10) return true;
  
  // Medium long words (>7 chars) not in common list
  if (cleanWord.length > 7 && !COMMON_WORDS.has(cleanWord.toLowerCase())) {
    return true;
  }
  
  // Words not in common list (case-insensitive check)
  if (!COMMON_WORDS.has(cleanWord.toLowerCase())) {
    // Only flag as difficult if it's reasonably long
    // Short words even if uncommon are still easy to read
    if (cleanWord.length >= 5) {
      return true;
    }
  }
  
  return false;
}
