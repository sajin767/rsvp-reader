import { Button } from '../components';

export function ReaderScreen() {
  return (
    <div className="flex flex-col h-full bg-black">
      <header className="flex items-center justify-between p-4">
        <Button variant="ghost" size="sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <span className="text-sm text-gray-400">Reader</span>
        <Button variant="ghost" size="sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="text-6xl font-mono text-white">
          <span className="text-red-500">R</span>eading
        </div>
        <p className="text-gray-500 mt-4">Select a book from the library</p>
      </main>

      <footer className="p-4">
        <div className="h-1 bg-gray-800 rounded-full">
          <div className="h-1 bg-blue-500 rounded-full w-0" />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>0:00</span>
          <span>0 WPM</span>
        </div>
      </footer>
    </div>
  );
}
