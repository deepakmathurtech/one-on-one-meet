# One-on-One Meet

A standalone no-login meeting-link project using browser-to-browser WebRTC.

## Use It

Open `index.html` in a browser, create a room name, then share the generated link.

Example link:

```text
http://127.0.0.1:8080/?room=career-clarity-call&name=Guest&title=LifeFundies%201-on-1
```

Anyone with the same link joins the same one-on-one room. The first person waits as host; the second person joins as guest.

This uses PeerJS for signaling and direct WebRTC media between browsers.

## Query Params

- `room`: shared room id. Required for direct join links.
- `name`: guest display name. Optional, defaults to `Guest`.
- `title`: meeting title. Optional, defaults to `One-on-One Meeting`.

## Local Server

From this folder:

```powershell
python -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/
```
