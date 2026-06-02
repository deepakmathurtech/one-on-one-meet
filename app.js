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
const openRoom = $("#open-room");
const leaveRoom = $("#leave-room");
const roomFrameWrap = $("#room-frame-wrap");
const roomFrame = $("#room-frame");

const params = new URLSearchParams(window.location.search);

function cleanRoom(value) {
  return (value || "one-on-one-room")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "one-on-one-room";
}

function cleanText(value, fallback) {
  return (value || fallback).trim().slice(0, 80) || fallback;
}

function buildMeetUrl({ room, name, title }) {
  const safeRoom = cleanRoom(room);
  const displayName = encodeURIComponent(cleanText(name, "Guest"));
  const appName = encodeURIComponent(cleanText(title, "One-on-One Meet"));

  const config = [
    `#userInfo.displayName="${displayName}"`,
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    "config.startWithAudioMuted=false",
    "config.startWithVideoMuted=false",
    'config.toolbarButtons=["microphone","camera","fullscreen","fodeviceselection","hangup","chat","settings","raisehand","videoquality","tileview"]',
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false",
    `interfaceConfig.APP_NAME=${appName}`,
  ]
    .join("&")
    .replace(/^#/, "");

  return `https://meet.jit.si/${safeRoom}#${config}`;
}

function buildShareLink({ room, name, title }) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", cleanRoom(room));
  if (name) url.searchParams.set("name", cleanText(name, "Guest"));
  if (title) url.searchParams.set("title", cleanText(title, "One-on-One Meet"));
  return url.toString();
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
  openRoom.href = buildMeetUrl({ room, name, title });

  joinRoom.onclick = () => {
    roomFrame.src = buildMeetUrl({ room, name, title });
    prejoin.hidden = true;
    roomFrameWrap.hidden = false;
  };
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

leaveRoom.addEventListener("click", () => {
  roomFrame.src = "";
  roomFrameWrap.hidden = true;
  prejoin.hidden = false;
});

showMeetingFromParams();
