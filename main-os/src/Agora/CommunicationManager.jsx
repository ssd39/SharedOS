import React, { useEffect, useMemo, useState } from "react";
import AgoraAudioHandler from "./AgoraAudioHandler";

export default function CommunicationManager({ channel_name }) {
  const agHandler = useMemo(() => new AgoraAudioHandler(), []);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMuted, setMuted] = useState(true);
  const [isJoined, setJoined] = useState(false);

  const joinChannel = async (channel_name) => {
    await agHandler.joinChannel(channel_name);
  };

  return (
    <>
      <button
        style={{ marginRight: 15, height: 48, width: 48 }}
        onClick={async () => {
          let localAudioTrack_ = localAudioTrack;
          if (isMuted) {
            if (!isJoined) {
              await joinChannel(channel_name);
              setJoined(true);
            }

            if (!localAudioTrack_) {
              localAudioTrack_ =
                await window.AgoraRTC.createMicrophoneAudioTrack();
              if (localAudioTrack_) {
                setLocalAudioTrack(localAudioTrack_);
              } else {
                return;
              }
            } else {
              localAudioTrack_.setMuted(false);
            }

            await agHandler.client.publish([localAudioTrack_]);
            setMuted(false);
          } else {
            localAudioTrack_.setMuted(true);
            setMuted(true);
          }
        }}
      >
        {isMuted ? (
          <img src="/mmicrophone.png" alt="Mic Muted" />
        ) : (
          <img src="/microphone.png" alt="Mic Unmuted" />
        )}
      </button>
    </>
  );
}
