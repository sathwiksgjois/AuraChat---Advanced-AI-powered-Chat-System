import { useState, useRef } from 'react';
import axios from '../../api/axios';

export default function StatusUploadModal({ isOpen, onClose, onSuccess }) {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file && !content.trim()) {
      alert('Please add some content or select a file.');
      return;
    }

    const formData = new FormData();
    if (content.trim()) formData.append('content', content);
    if (file) formData.append('file', file);

    setUploading(true);
    setProgress(0);

    try {
      await axios.post('/status/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        },
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Status upload failed', err);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    setContent('');
    setFile(null);
    setPreview(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Add Status</h2>

        {/* Text input */}
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full border rounded p-2 mb-3"
          rows="3"
        />

        {/* File picker */}
        <div className="mb-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="w-full bg-gray-100 border border-dashed rounded p-3 text-gray-600 hover:bg-gray-200"
          >
            {preview ? 'Change media' : 'Add photo or video'}
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="mb-3">
            {file?.type.startsWith('image/') ? (
              <img src={preview} alt="preview" className="max-h-40 rounded mx-auto" />
            ) : file?.type.startsWith('video/') ? (
              <video src={preview} controls className="max-h-40 rounded mx-auto" />
            ) : null}
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="mb-3">
            <div className="h-2 bg-gray-200 rounded">
              <div className="h-2 bg-purple-600 rounded" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">Uploading... {progress}%</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={handleCancel} className="px-4 py-2 bg-gray-300 rounded">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}