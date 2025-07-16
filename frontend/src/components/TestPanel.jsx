import { useState } from "react";
import { runFullConnectionTest } from "../utils/connectionTest";

const TestPanel = () => {
  const [testResults, setTestResults] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    const results = await runFullConnectionTest();
    setTestResults(results);
    setTesting(false);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-base-200 p-4 rounded-lg shadow-lg max-w-sm">
      <h3 className="font-bold mb-2">Connection Test</h3>
      
      <button 
        onClick={handleTest} 
        disabled={testing}
        className="btn btn-sm btn-primary mb-2 w-full"
      >
        {testing ? "Testing..." : "Run Test"}
      </button>

      {testResults && (
        <div className="text-xs space-y-1">
          <div className={`flex justify-between ${testResults.backend.success ? 'text-success' : 'text-error'}`}>
            <span>Backend:</span>
            <span>{testResults.backend.success ? '✅' : '❌'}</span>
          </div>
          <div className={`flex justify-between ${testResults.socket.success ? 'text-success' : 'text-error'}`}>
            <span>Socket:</span>
            <span>{testResults.socket.success ? '✅' : '❌'}</span>
          </div>
          <div className={`flex justify-between ${testResults.media.success ? 'text-success' : 'text-error'}`}>
            <span>Media:</span>
            <span>{testResults.media.success ? '✅' : '❌'}</span>
          </div>
          <div className={`flex justify-between ${testResults.webrtc.success ? 'text-success' : 'text-error'}`}>
            <span>WebRTC:</span>
            <span>{testResults.webrtc.success ? '✅' : '❌'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestPanel;