const $ = (selector) => document.querySelector(selector);

const setupPanel = $("#setup-panel");
const meetingPanel = $("#meeting-panel");
const linkForm = $("#link-form");
const generatedLink = $("#generated-link");
const generatedUrl = $("#generated-url");
const copyLink = $("#copy-link");
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
const callRoom = $("#call-room");
const localVideo = $("#local-video");
const remoteVideo = $("#remote-video");
const connectionStatus = $("#connection-status");
const roleStatus = $("#role-status");

const params = new URLSearchParams(window.location.search);
let peer = null;
let localStream = null;
let activeCall = null;
let retryTimer = null;

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

function setRemoteStream(stream) {
  remoteVideo.srcObject = stream;
  setStatus("Connected. You are in the one-on-one call.");
}

async function getMedia() {
  if (localStream) return localStream;

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;
  return localStream;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
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
  callRoom.hidden = true;
  prejoin.hidden = false;
  setStatus("Call ended.");
}

function answerIncomingCalls(stream) {
  peer.on("call", (call) => {
    if (activeCall) activeCall.close();
    activeCall = call;
    setStatus("Answering incoming guest...");
    call.answer(stream);
    call.on("stream", setRemoteStream);
    call.on("close", () => setStatus("The other person left the call."));
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

function createGuestPeer(room, stream) {
  peer = new Peer(`${room}-guest-${randomId()}`);
  roleStatus.textContent = "Guest";

  peer.on("open", () => callHost(room, stream));
  peer.on("error", () => {
    retryTimer = window.setTimeout(() => callHost(room, stream), 1800);
  });
}

function createHostPeer(room, stream) {
  const hostId = `${room}-host`;
  peer = new Peer(hostId);
  roleStatus.textContent = "Host";

  peer.on("open", () => {
    setStatus("Waiting for the other person to open this same link...");
    answerIncomingCalls(stream);
  });

  peer.on("error", (error) => {
    if (error.type === "unavailable-id") {
      setStatus("Host is already waiting. Joining as guest...");
      createGuestPeer(room, stream);
      return;
    }
    setStatus(`Connection error: ${error.type || "unknown"}`);
  });
}

async function startRoom(room) {
  try {
    prejoin.hidden = true;
    callRoom.hidden = false;
    setStatus("Requesting camera and microphone...");

    const stream = await getMedia();
    setStatus("Starting connection...");
    createHostPeer(room, stream);
  } catch (error) {
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

  setupPanel.hidden = true;
  meetingPanel.hidden = false;
  meetingTitle.textContent = title;
  meetingSubtitle.textContent = `Room: ${cleanRoom(room)}. Joining as ${name}.`;
  prejoinTitle.textContent = `Ready, ${name}?`;
  avatar.textContent = name.charAt(0).toUpperCase();

  joinRoom.onclick = () => startRoom(cleanRoom(room));
}

linkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const shareLink = buildShareLink({
    room: roomInput.value,
    name: nameInput.value,
    title: titleInput.value,
  });
  generatedUrl.textContent = shareLink;
  generatedLink.hidden = false;
});

copyLink.addEventListener("click", async () => {
  const text = generatedUrl.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyLink.textContent = "Copied";
    setTimeout(() => {
      copyLink.textContent = "Copy";
    }, 1200);
  } catch {
    window.prompt("Copy this meeting link:", text);
  }
});

leaveRoom.addEventListener("click", stopCall);
window.addEventListener("beforeunload", stopCall);

showMeetingFromParams();
