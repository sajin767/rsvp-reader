import { Button } from '../components';

export function FlashcardsScreen() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Flashcards</h1>
        <Button variant="secondary" size="sm">
          Export
        </Button>
      </header>

      <main className="flex-1 p-4 overflow-auto">
        <div className="text-center text-gray-400 mt-20">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-lg">No flashcards saved</p>
          <p className="text-sm mt-1">Tap words while reading to save them</p>
        </div>
      </main>
    </div>
  );
}
