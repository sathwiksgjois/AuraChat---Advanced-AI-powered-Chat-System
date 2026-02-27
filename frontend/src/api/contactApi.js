import api from "./axios";

export const fetchContactsAPI = async () => {
  return api.get("/contacts/");
};

export const addContact = (data) => {
  return api.post("/contacts/add/", data);
};
