import { useContext, useState, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import axios from "../../api/axios";

export default function ProfileModal({ isOpen, onClose }) {
  const { user, setUser } = useContext(AuthContext);
  const { uiLanguage, changeUiLanguage } = useLanguage();
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone_number: user?.phone_number || '',
    bio: user?.bio || '',
    preferred_language: user?.preferred_language || 'en',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update profile fields
      const profileData = new FormData();
      profileData.append('full_name', formData.full_name);
      profileData.append('email', formData.email);
      profileData.append('phone_number', formData.phone_number);
      profileData.append('bio', formData.bio);
      profileData.append('preferred_language', formData.preferred_language);
      if (avatarFile) {
        profileData.append('avatar', avatarFile);
      }

      const response = await axios.put('/auth/profile/', profileData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUser(response.data);
      if (formData.preferred_language !== user?.preferred_language) {
        changeUiLanguage(formData.preferred_language);
      }
      setEditMode(false);
    } catch (err) {
      console.error('Failed to update profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone_number: user?.phone_number || '',
      bio: user?.bio || '',
      preferred_language: user?.preferred_language || 'en',
    });
    setAvatarPreview(user?.avatar || null);
    setAvatarFile(null);
    setEditMode(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24 mb-3">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-200">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-purple-400 to-indigo-400 flex items-center justify-center text-white text-3xl font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {editMode && (
                <>
                  <button
                    onClick={() => fileInputRef.current.click()}
                    className="absolute bottom-0 right-0 bg-purple-600 text-white rounded-full p-1.5 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </>
              )}
            </div>
            <p className="text-xl font-semibold">@{user?.username}</p>
            <p className="text-sm text-gray-500">Joined {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}</p>
          </div>

          {!editMode ? (
            // View mode
            <>
              <div className="space-y-3 border-t pt-4">
                <div><span className="font-medium">Full Name:</span> {user?.full_name || 'Not set'}</div>
                <div><span className="font-medium">Email:</span> {user?.email}</div>
                <div><span className="font-medium">Phone:</span> {user?.phone_number || 'Not provided'}</div>
                <div><span className="font-medium">Bio:</span> {user?.bio || 'No bio yet'}</div>
                <div><span className="font-medium">Language:</span> {user?.preferred_language === 'en' ? 'English' : user?.preferred_language === 'hi' ? 'हिन्दी' : 'ಕನ್ನಡ'}</div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="w-full mt-4 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
              >
                Edit Profile
              </button>
            </>
          ) : (
            // Edit mode
            <>
              <div className="space-y-4">
                <input
                  type="text"
                  name="full_name"
                  placeholder="Full Name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <input
                  type="tel"
                  name="phone_number"
                  placeholder="Phone Number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <textarea
                  name="bio"
                  placeholder="Bio"
                  rows="3"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
                <select
                  name="preferred_language"
                  value={formData.preferred_language}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                  <option value="kn">ಕನ್ನಡ</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={handleCancel} className="px-4 py-2 bg-gray-300 rounded-lg">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}