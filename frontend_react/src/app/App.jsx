import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "../context/AppContext";
import AppShell from "./AppShell";
import HomePage from "../pages/HomePage/HomePage";
import SearchingPage from "../pages/SearchingPage/SearchingPage";
import ChatPage from "../pages/ChatPage/ChatPage";
import AfterChatPage from "../pages/AfterChatPage/AfterChatPage";
import MyChatsPage from "../pages/MyChatsPage/MyChatsPage";
import StoriesPage from "../pages/StoriesPage/StoriesPage";

function HtmlLangSync() {
  const { language } = useApp();
  useEffect(() => {
    document.documentElement.lang = language === "ru" ? "ru" : "en";
  }, [language]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <HtmlLangSync />
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/searching" element={<SearchingPage />} />
            <Route path="/chat/:id" element={<ChatPage />} />
            <Route path="/chat" element={<Navigate to="/" replace />} />
            <Route path="/after" element={<AfterChatPage />} />
            <Route path="/my-chats" element={<MyChatsPage />} />
            <Route path="/stories" element={<StoriesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  );
}
