import React, { useState, useEffect, useRef } from "react";
import { ChatState } from "../context/ChatProvider";
import {
  Box,
  Text,
  Heading,
  Divider,
  FormControl,
  Input,
} from "@chakra-ui/react";
import { IoIosArrowBack } from "react-icons/io";
import { getSender } from "../config/ChatLogics";
import ProfileModel from "./ProfileModel";
import UpdateGroupChatModal from "./UpdateGroupChatModal";
import Loader from "./Loader";
import { toast } from "react-toastify";
import axios from "axios";
import ScrollableChat from "./ScrollableChat";
import io from "socket.io-client";

const ENDPOINT = "http://localhost:5000";
let socket;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const { user, selectedChat, setSelectedChat, notification, setNotification } =
    ChatState();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Use useRef to always hold latest selectedChat for event handlers
  const selectedChatCompare = useRef();

  // Fetch messages
  const fetchAllMessages = async () => {
    if (!selectedChat) return;
    try {
      setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };
      const { data } = await axios.get(
        `/api/message/${selectedChat._id}`,
        config
      );
      setMessages(data);
      setLoading(false);
      socket.emit("join chat", selectedChat._id);
    } catch (err) {
      toast.error("Failed to load messages");
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (e) => {
    if (e.key === "Enter" && newMessage.trim()) {
      socket.emit("stop typing", selectedChat._id);
      try {
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        const { data } = await axios.post(
          "/api/message",
          {
            chatId: selectedChat._id,
            content: newMessage,
          },
          config
        );
        setNewMessage("");
        setMessages((prevMessages) => [...prevMessages, data]); // add message immediately
        socket.emit("new message", data);
      } catch (err) {
        toast.error("Failed to send message");
      }
    }
  };

  const saveNotification = async () => {
    if (!notification.length) return;
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      };
      await axios.post(
        "/api/notification",
        {
          notification: notification[0].chatId.latestMessage,
        },
        config
      );
    } catch (err) {
      toast.error("Notification error");
    }
  };

  useEffect(() => {
    socket = io(ENDPOINT);
    socket.emit("setup", user.user);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    // Cleanup on component unmount
    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    selectedChatCompare.current = selectedChat;
    fetchAllMessages();
  }, [selectedChat]);

  useEffect(() => {
    const handler = (newMessageReceived) => {
      // If message is NOT for current chat, add notification
      if (
        !selectedChatCompare.current ||
        selectedChatCompare.current._id !== newMessageReceived.chatId._id
      ) {
        if (!notification.find((n) => n._id === newMessageReceived._id)) {
          setNotification([newMessageReceived, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        // Only add message if sender is NOT current user
        if (
          String(newMessageReceived.sender._id) !==
          String(user.user._id)
        ) {
          setMessages((prevMessages) => [...prevMessages, newMessageReceived]);
        }
      }
    };

    socket.on("message received", handler);

    return () => {
      socket.off("message received", handler);
    };
  }, [notification, fetchAgain, setFetchAgain, user.user._id]);

  useEffect(() => {
    saveNotification();
  }, [notification]);

  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }

    const lastTypingTime = new Date().getTime();
    const timerLength = 3000;

    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  return (
    <>
      {selectedChat ? (
        <>
          <Box
            py="3"
            px="4"
            w="100%"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            bg="#fff"
            borderRadius="lg"
          >
            <Box
              display={{ base: "flex", md: "none" }}
              mr="5"
              onClick={() => setSelectedChat("")}
              cursor="pointer"
            >
              <IoIosArrowBack />
            </Box>

            {!selectedChat.isGroupChat ? (
              <Text
                display="flex"
                py="3"
                alignItems="center"
                justifyContent="space-between"
                fontSize={{ base: "1.5rem", md: "1.75rem" }}
                w="100%"
              >
                <Box display="flex" flexDir="column" alignItems="flex-start">
                  {getSender(user.user, selectedChat.users).name}
                  <Box minH="10px">
                    {isTyping && <Text fontSize="sm">Typing...</Text>}
                  </Box>
                </Box>
                <ProfileModel user={getSender(user.user, selectedChat.users)} />
              </Text>
            ) : (
              <>
                {selectedChat.chatName.toUpperCase()}
                <UpdateGroupChatModal
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                  fetchAllMessages={fetchAllMessages}
                />
              </>
            )}
          </Box>

          <Box
            display="flex"
            flexDir="column"
            p="3"
            w="100%"
            h={{ base: "73vh", md: "100%" }}
            overflowY="hidden"
          >
            {loading ? (
              <Loader />
            ) : (
              <div className="message">
                <ScrollableChat messages={messages} />
              </div>
            )}
          </Box>

          <FormControl
            onKeyDown={sendMessage}
            isRequired
            mt="3"
            border="1px solid #fff"
            borderRadius="8px"
          >
            <Input
              variant="outline"
              bg="#1d1931"
              h="4rem"
              color="#fff"
              placeholder="Enter a message..."
              onChange={typingHandler}
              value={newMessage}
            />
          </FormControl>
        </>
      ) : (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          h="100%"
          flexDir="column"
          color="rgba(255, 255, 255, 0.685)"
        >
          <Heading size="4xl" mb="4">
            NexChat
          </Heading>
          <Divider />
          <Text fontSize="3xl" px="3">
            Select a user to start chat
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
