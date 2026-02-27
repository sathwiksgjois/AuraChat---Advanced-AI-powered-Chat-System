import { useState, useRef } from 'react';

export default function VoiceRecorder({ onSend }) {
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
    mediaRecorder.current.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioURL(url);
      chunks.current = [];
    };
    mediaRecorder.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current.stop();
    mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    setRecording(false);
  };

  const sendRecording = () => {
    if (!audioURL) return;
    fetch(audioURL)
      .then(res => res.blob())
      .then(blob => {
        onSend(blob);
        setAudioURL(null);
      });
  };

  return (
    <div className="flex items-center gap-2">
      {!recording && !audioURL && (
        <button onClick={startRecording} className="text-red-500 p-1 hover:bg-gray-100 rounded" title="Record voice">
          🎤
        </button>
      )}
      {recording && (
        <button onClick={stopRecording} className="text-red-700 p-1 hover:bg-gray-100 rounded">
          ⏹️ Stop
        </button>
      )}
      {audioURL && (
        <>
          <audio src={audioURL} controls className="h-8" />
          <button onClick={sendRecording} className="text-green-600 p-1 hover:bg-gray-100 rounded">
            Send
          </button>
        </>
      )}
    </div>
  );
}