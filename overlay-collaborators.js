const collaborators = Object.freeze([
  Object.freeze({
    name: "Vardil",
    platform: "Twitch",
    url: "https://www.twitch.tv/vardil_",
  }),
  Object.freeze({
    name: "Rafaelzinanni",
    platform: "Twitch",
    url: "https://www.twitch.tv/rafaelzinanni",
  }),
]);

if (typeof window !== "undefined") window.OVERLAY_COLLABORATORS = collaborators;
if (typeof module !== "undefined") module.exports = collaborators;
