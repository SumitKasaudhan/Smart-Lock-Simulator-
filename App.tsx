
import React, { useState, useEffect, useCallback } from 'react';
import { LockState } from './types';
import { SECRET_CODE, MAX_ATTEMPTS, LOCKOUT_DURATION_MS } from './constants';
import Keypad from './components/Keypad';
import SevenSegmentDisplay from './components/SevenSegmentDisplay';
import StatusIndicator from './components/StatusIndicator';
import VHDLCodeViewer from './components/VHDLCodeViewer';
import { generateVHDLForLock } from './services/geminiService';

const App: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('');
  const [lockState, setLockState] = useState<LockState>(LockState.Locked);
  const [attempts, setAttempts] = useState<number>(0);
  const [lockoutTimer, setLockoutTimer] = useState<number>(0);
  const [vhdlCode, setVhdlCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let timerId: number;
    if (lockState === LockState.Lockout) {
      setLockoutTimer(LOCKOUT_DURATION_MS / 1000);
      timerId = window.setInterval(() => {
        setLockoutTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerId);
            setLockState(LockState.Locked);
            setAttempts(0);
            setUserInput('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [lockState]);

  const handleKeyPress = (key: string) => {
    if (lockState === LockState.Lockout || lockState === LockState.Unlocked) return;

    if (key === 'C') {
      setUserInput('');
      if (lockState === LockState.Error) {
        setLockState(LockState.Locked);
      }
    } else if (key === 'E') {
      if (userInput === SECRET_CODE) {
        setLockState(LockState.Unlocked);
        setAttempts(0);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setLockState(LockState.Error);
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockState(LockState.Lockout);
        } else {
            setTimeout(() => {
                // FIX: Use a functional update to get the current state. This avoids a race
                // condition where a timeout from a previous error could reset the state from
                // Lockout back to Locked. It also resolves the TypeScript error, which correctly
                // identified that the old comparison was always true due to stale state.
                setLockState(currentLockState => {
                    if (currentLockState !== LockState.Lockout) {
                        setLockState(LockState.Locked);
                        setUserInput('');
                    }
                    return currentLockState;
                });
            }, 1000);
        }
      }
    } else if (userInput.length < 4) {
      setUserInput(prev => prev + key);
      if (lockState === LockState.Error) {
        setLockState(LockState.Locked);
      }
    }
  };

  const handleMasterReset = () => {
    setUserInput('');
    setLockState(LockState.Locked);
    setAttempts(0);
    setLockoutTimer(0);
    // Note: We don't clear the generated VHDL code on reset
  };
  
  const handleGenerateCode = useCallback(async () => {
    setIsGenerating(true);
    setError('');
    setVhdlCode('');
    try {
      const code = await generateVHDLForLock();
      setVhdlCode(code);
    } catch (err) {
      setError('Failed to generate VHDL code. Please check your API key and try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const getDisplayValue = () => {
    if (lockState === LockState.Lockout) return '----';
    if (lockState === LockState.Error) return 'Err';
    if (lockState === LockState.Unlocked) return 'Open';
    return userInput.padEnd(4, '_');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 tracking-wider">VHDL Smart Lock Simulator</h1>
          <p className="text-gray-400 mt-2 text-lg">An interactive simulation of an FPGA-based digital lock system.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Simulator */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700 flex flex-col items-center justify-between">
            <div className="w-full max-w-xs mx-auto">
              <h2 className="text-2xl font-semibold text-center mb-4 text-white">Digital Lock Interface</h2>
              <SevenSegmentDisplay value={getDisplayValue()} />
              <StatusIndicator state={lockState} lockoutTime={lockoutTimer} />
              <Keypad onKeyPress={handleKeyPress} disabled={lockState === LockState.Lockout} />
            </div>
            <button
              onClick={handleMasterReset}
              className="mt-6 w-full max-w-xs bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
            >
              Master Reset
            </button>
          </div>

          {/* Right Panel: VHDL Code */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700 flex flex-col">
              <VHDLCodeViewer 
                code={vhdlCode}
                isLoading={isGenerating}
                error={error}
                onGenerate={handleGenerateCode}
              />
          </div>
        </div>

        <footer className="text-center mt-8 text-gray-500">
          <p>Built with React, TypeScript, Tailwind CSS, and the Gemini API.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
