const $ = (selector) => document.querySelector(selector);

const setupPanel = $("#setup-panel");
const meetingPanel = $("#meeting-panel");
const linkForm = $("#link-form");
const generatedLink = $("#generated-link");
const generatedUrl = $("#generated-url");
const copyLink = $("#copy-link");
const openLink = $("#open-link");
const roomInput = $("#room-input");
const nameInput = $("#name-input");
const titleInput = $("#title-input");
const meetingTitle = $("#meeting-title");
const meetingSubtitle = $("#meeting-subtitle");
const prejoinTitle = $("#prejoin-title");
const avatar = $("#avatar");
const prejoin = $("#prejoin");
const joinRoom = $("#join-room");
const leaveRoom = $("#leave-room");
const leaveRoomBottom = $("#leave-room-bottom");
const callRoom = $("#call-room");
const localVideo = $("#local-video");
const remoteVideo = $("#remote-video");
const connectionStatus = $("#connection-status");
const roleStatus = $("#role-status");
const shareRoom = $("#share-room");
const copyRoomBeforeJoin = $("#copy-room-before-join");
const copyRoomDuringCall = $("#copy-room-during-call");
const toggleMic = $("#toggle-mic");
const toggleCamera = $("#toggle-camera");
const callTimer = $("#call-timer");
const recentRooms = $("#recent-rooms");
const recentRoomList = $("#recent-room-list");

const params = new URLSearchParams(window.location.search);
const recentKey = "one-on-one-meet-recent-rooms";
let peer = null;
let localStream = null;
let activeCall = null;
let retryTimer = null;
let timerInterval = null;
let callStartedAt = null;
let currentShareLink = window.location.href;

function cleanRoom(value) {
  return (value || "one-on-one-room")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48) || "one-on-one-room";
}

function cleanText(value, fallback) {
  return (value || fallback).trim().slice(0, 80) || fallback;
}

function buildShareLink({ room, name, title }) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", cleanRoom(room));
  if (name) url.searchParams.set("name", cleanText(name, "Guest"));
  if (title) url.searchParams.set("title", cleanText(title, "One-on-One Meet"));
  return url.toString();
}

function setStatus(message) {
  connectionStatus.textContent = message;
}

function setButtonCopied(button, text = "Copied") {
  const original = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1300);
}

async function copyText(text, button) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    if (button) setButtonCopied(button);
  } catch {
    window.prompt("Copy this meeting link:", text);
  }
}

async function shareOrCopy(button) {
  const shareData = {
    title: meetingTitle.textContent || "One-on-One Meet",
    text: "Join this one-on-one video call.",
    url: currentShareLink,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // Fall back to clipboard when native share is cancelled or unavailable.
    }
  }

  await copyText(currentShareLink, button);
}

function readRecentRooms() {
  try {
    return JSON.parse(localStorage.getItem(recentKey) || "[]");
  } catch {
    return [];
  }
}

function saveRecentRoom(link, title) {
  const current = readRecentRooms().filter((item) => item.link !== link);
  const next = [{ link, title, savedAt: Date.now() }, ...current].slice(0, 5);
  localStorage.setItem(recentKey, JSON.stringify(next));
  renderRecentRooms();
}

function renderRecentRooms() {
  const rooms = readRecentRooms();
  recentRooms.hidden = rooms.length === 0;
  recentRoomList.innerHTML = "";

  rooms.forEach((room) => {
    const anchor = document.createElement("a");
    anchor.href = room.link;
    anchor.textContent = room.title || "One-on-One Room";
    recentRoomList.append(anchor);
  });
}

function setRemoteStream(stream) {
  remoteVideo.srcObject = stream;
  startTimer();
  setStatus("Connected. You are in the one-on-one call.");
}

async function getMedia() {
  if (localStream) return localStream;

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;
  updateTrackButtons();
  return localStream;
}

function updateTrackButtons() {
  const audioTrack = localStream?.getAudioTracks()[0];
  const videoTrack = localStream?.getVideoTracks()[0];
  toggleMic.textContent = audioTrack?.enabled === false ? "Mic Off" : "Mic On";
  toggleCamera.textContent = videoTrack?.enabled === false ? "Camera Off" : "Camera On";
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  if (timerInterval) return;
  callStartedAt = Date.now();
  callTimer.textContent = "00:00";
  timerInterval = window.setInterval(() => {
    callTimer.textContent = formatTime(Date.now() - callStartedAt);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
  callStartedAt = null;
  callTimer.textContent = "00:00";
}

function stopCall() {
  if (retryTimer) window.clearTimeout(retryTimer);
  retryTimer = null;
  if (activeCall) activeCall.close();
  activeCall = null;
  if (peer) peer.destroy();
  peer = null;
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  localStream = null;
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  roleStatus.textContent = "";
  callRoom.hidden = true;
  prejoin.hidden = false;
  stopTimer();
  setStatus("Call ended.");
}

function answerIncomingCalls(stream) {
  peer.on("call", (call) => {
    if (activeCall) activeCall.close();
    activeCall = call;
    setStatus("Answering incoming guest...");
    call.answer(stream);
    call.on("stream", setRemoteStream);
    call.on("close", () => {
      activeCall = null;
      remoteVideo.srcObject = null;
      stopTimer();
      setStatus("The other person left the call.");
    });
  });
}

function callHost(room, stream) {
  if (!peer || peer.destroyed || activeCall) return;

  setStatus("Looking for the other person...");
  const call = peer.call(`${room}-host`, stream);
  activeCall = call;

  call.on("stream", setRemoteStream);
  call.on("close", () => {
    activeCall = null;
    remoteVideo.srcObject = null;
    stopTimer();
    setStatus("The other person left the call.");
  });
  call.on("error", () => {
    activeCall = null;
    retryTimer = window.setTimeout(() => callHost(room, stream), 1800);
  });

  retryTimer = window.setTimeout(() => {
    if (!remoteVideo.srcObject && activeCall === call) {
      activeCall = null;
      call.close();
      callHost(room, stream);
    }
  }, 3000);
}

function createGuestPeer(room, stream, PeerCtor) {
  peer = new PeerCtor(`${room}-guest-${randomId()}`);
  roleStatus.textContent = "Guest";

  peer.on("open", () => callHost(room, stream));
  peer.on("error", () => {
    retryTimer = window.setTimeout(() => callHost(room, stream), 1800);
  });
}

function createHostPeer(room, stream, PeerCtor) {
  const hostId = `${room}-host`;
  peer = new PeerCtor(hostId);
  roleStatus.textContent = "Host";

  peer.on("open", () => {
    setStatus("Waiting for the other person to open this same link...");
    answerIncomingCalls(stream);
  });

  peer.on("error", (error) => {
    if (error.type === "unavailable-id") {
      setStatus("Host is already waiting. Joining as guest...");
      createGuestPeer(room, stream, PeerCtor);
      return;
    }
    setStatus(`Connection error: ${error.type || "unknown"}`);
  });
}

async function startRoom(room) {
  const PeerCtor = window.Peer || window.peerjs?.Peer;

  if (!PeerCtor) {
    alert("The calling library did not load. Please refresh the page and try again.");
    return;
  }

  try {
    prejoin.hidden = true;
    callRoom.hidden = false;
    setStatus("Requesting camera and microphone...");

    const stream = await getMedia();
    setStatus("Starting connection...");
    createHostPeer(room, stream, PeerCtor);
  } catch {
    prejoin.hidden = false;
    callRoom.hidden = true;
    setStatus("Could not access camera or microphone.");
    alert("Please allow camera and microphone permissions to join the call.");
  }
}

function showMeetingFromParams() {
  const room = params.get("room");
  if (!room) return;

  const name = cleanText(params.get("name"), "Guest");
  const title = cleanText(params.get("title"), "One-on-One Meeting");
  currentShareLink = buildShareLink({ room, name, title });

  setupPanel.hidden = true;
  meetingPanel.hidden = false;
  meetingTitle.textContent = title;
  meetingSubtitle.textContent = `Room: ${cleanRoom(room)}. Joining as ${name}.`;
  prejoinTitle.textContent = `Ready, ${name}?`;
  avatar.textContent = name.charAt(0).toUpperCase();
  document.title = `${title} - One-on-One Meet`;

  saveRecentRoom(currentShareLink, title);
  joinRoom.onclick = () => startRoom(cleanRoom(room));
}

linkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const shareLink = buildShareLink({
    room: roomInput.value,
    name: nameInput.value,
    title: titleInput.value,
  });
  const title = cleanText(titleInput.value, "One-on-One Meet");
  currentShareLink = shareLink;
  generatedUrl.textContent = shareLink;
  generatedLink.hidden = false;
  saveRecentRoom(shareLink, title);
});

copyLink.addEventListener("click", () => copyText(generatedUrl.textContent, copyLink));
openLink.addEventListener("click", () => {
  if (generatedUrl.textContent) window.location.href = generatedUrl.textContent;
});
shareRoom.addEventListener("click", () => shareOrCopy(shareRoom));
copyRoomBeforeJoin.addEventListener("click", () => copyText(currentShareLink, copyRoomBeforeJoin));
copyRoomDuringCall.addEventListener("click", () => copyText(currentShareLink, copyRoomDuringCall));
leaveRoom.addEventListener("click", stopCall);
leaveRoomBottom.addEventListener("click", stopCall);

toggleMic.addEventListener("click", () => {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  updateTrackButtons();
});

toggleCamera.addEventListener("click", () => {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  updateTrackButtons();
});

window.addEventListener("beforeunload", stopCall);

renderRecentRooms();
showMeetingFromParams();
