import api from "./axios";

export const getUserChatRooms = async () => {
  const response = await api.get("chat/rooms/");
  return response.data;
};

export const getRoomMessages = async (roomId) => {
  const response = await api.get(`chat/rooms/${roomId}/messages/`);
  return response.data;
};

export const sendMessage = async (roomId, content) => {
  const response = await api.post(
    `chat/rooms/${roomId}/send/`,
    { content }
  );
  return response.data;
};

// export const startPrivateChat = async (userId) => {
//   const response = await api.post("/private/", { user_id: userId });
//   return response.data;
// };
