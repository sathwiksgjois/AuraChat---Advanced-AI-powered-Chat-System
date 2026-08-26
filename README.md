# AuraChat

> **A secure, AI-powered real-time messaging platform built with Django, React, and WebSockets, featuring end-to-end encryption and intelligent conversation assistance.**

<p align="left">
  <img src="https://img.shields.io/badge/Django-5.x-092E20?style=for-the-badge&logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/WebSockets-Real--Time-4CAF50?style=for-the-badge" />
  <img src="https://img.shields.io/badge/AI-Powered-7B61FF?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Encryption-AES--256-D32F2F?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-blueviolet?style=for-the-badge" />
</p>

---

## Overview

AuraChat is a modern full-stack messaging platform that combines secure communication with AI-powered productivity features. It provides real-time messaging through WebSockets, protects conversations using end-to-end AES encryption, and enhances user experience with intelligent capabilities such as smart replies, translation, sentiment analysis, and chat summarization.

The project demonstrates scalable backend architecture, real-time communication, authentication, and AI integration in a production-oriented chat system.

---

## Features

### Secure Messaging

- End-to-End AES Encryption
- JWT Authentication
- Private Conversations
- Group Chats
- Secure User Authentication

### Real-Time Communication

- WebSocket-based messaging
- Typing indicators
- Message reactions
- Presence updates
- Instant message delivery

### AI Features

- Smart AI replies
- Conversation summarization
- Multi-language translation
- Sentiment analysis
- AI-assisted communication

### User Experience

- User search
- Chat room management
- Responsive interface
- Modern messaging UI

---

## Architecture

```text
                    Client (React)
                           │
                    JWT Authentication
                           │
                Django REST Framework
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
     REST API                       Django Channels
          │                          (WebSockets)
          │                                 │
          └──────────────┬──────────────────┘
                         ▼
                 Chat Service Layer
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    AI Services    Encryption     Database
          │
          ▼
 Smart Replies • Translation •
 Sentiment Analysis • Summarization
```

---

## Technology Stack

### Frontend

- React
- Tailwind CSS
- JavaScript
- WebSocket API

### Backend

- Django
- Django REST Framework
- Django Channels
- Celery
- JWT Authentication

### AI

- Smart Replies
- Chat Summarization
- Translation
- Sentiment Analysis

### Database

- SQLite (Development)
- PostgreSQL (Production Ready)

---

## Core Modules

- Authentication
- User Management
- Chat Rooms
- Real-Time Messaging
- AI Service Layer
- Encryption Engine
- Notification System

---

## Project Structure

```text
AuraChat/
├── backend/
│   ├── accounts/
│   ├── chat/
│   ├── ai/
│   ├── config/
│   └── manage.py
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/sathwiksgjois/AuraChat.git
cd AuraChat
```

### Backend

```bash
cd backend

python -m venv venv
```

#### Linux / macOS

```bash
source venv/bin/activate
```

#### Windows

```powershell
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start the development server:

```bash
python manage.py runserver
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## Future Roadmap

- [x] Real-time messaging
- [x] WebSockets
- [x] JWT Authentication
- [x] AI Smart Replies
- [x] Translation
- [x] Sentiment Analysis
- [x] Chat Summarization
- [x] Voice messaging
- [x] File sharing
- [ ] Video calling
- [ ] Push notifications
- [ ] AI conversation memory
- [ ] Offline message synchronization

---

## Motivation

AuraChat explores how secure communication and AI assistance can be combined into a modern messaging platform. The project focuses on real-time systems, backend engineering, secure authentication, WebSocket communication, and AI-powered user experiences.

---

## License

This project is licensed under the MIT License.
