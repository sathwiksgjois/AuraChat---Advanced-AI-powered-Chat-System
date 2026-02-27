import { createContext, useState, useEffect } from "react";
import { fetchContactsAPI } from "../api/contactApi";

export const ContactsContext = createContext();

export const ContactsProvider = ({ children }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await fetchContactsAPI();
      setContacts(res.data.results);
    } catch (err) {
      console.error("Failed to fetch contacts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <ContactsContext.Provider
      value={{
        contacts,
        loading,
        fetchContacts,
        setContacts,
      }}
    >
      {children}
    </ContactsContext.Provider>
  );
};