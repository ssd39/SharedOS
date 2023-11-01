import React, { useEffect, useState } from "react";
import urlParser from "js-video-url-parser";
import * as Y from "yjs";
import { AblyProvider } from "../y-ably/y-ably";
/**
 *
 * @param {Object} param
 * @param {Y.Doc} param.ydoc
 * @param {AblyProvider} param.ablyProvider
 * @returns
 */
export default function YtApp({ height, width, ydoc, uid, ablyProvider, url }) {
  const [vidUrl, setVidUrl] = useState(url);
  const ytMap = ydoc.getMap(`yt_${uid}`);
  const [player, setPlayer] = useState(null);
  const [vidState, setVidstate] = useState(2);
  const [syncTimer, setSyncTimer] = useState(null);
  const [curTime, setCurTime] = useState(0);
  const [leader, setLeader] = useState("");
  const onPlayerReady = (event) => {
    if (vidState == 2) {
      event.target.pauseVideo();
    } else {
      event.target.playVideo();
    }
  };

  const onPlayerStateChange = (event) => {
    console.log(event);
    if (event.data == 1 || event.data == 2) {
      ydoc.transact(() => {
        console.log("editing", event.data);
        ytMap.set("vidstate", event.data);
      });
    }
  };

  const addIframe = () => {
    document.getElementById(`${uid}_player`).innerHTML = "";
    const player_ = new window.YT.Player(`${uid}_player`, {
      height: "100%",
      width: "100%",
      videoId: urlParser.parse(vidUrl).id,
      playerVars: {
        playsinline: 1,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
    setPlayer(player_);
  };

  useEffect(() => {
    if (player) {
      if (vidState == 2) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }
  }, [vidState]);

  useEffect(() => {
    if (player && leader != ablyProvider.room.peerId) {
      console.log("seeking auto");
      if (typeof player?.seekTo === "function") {
        player.seekTo(curTime, true);
      }
    }
  }, [curTime]);

  useEffect(() => {
    if (syncTimer) {
      clearInterval(syncTimer);
    }
    if (player) {
      let newTimer = setInterval(() => {
        try {
          console.log(leader, ablyProvider.room.peerId);
          if (leader == ablyProvider.room.peerId) {
            console.log("seeking ahead");
            ytMap.set("current", player.getCurrentTime());
          } else {
            if (Math.abs(player.getCurrentTime() - curTime) > 5) {
              ydoc.transact(() => {
                ytMap.set("current", player.getCurrentTime());
                ytMap.set("leader", ablyProvider.room.peerId);
              });
              clearInterval(syncTimer);
            } else if (!ablyProvider.room.roomPeers.has(leader)) {
              ytMap.set("leader", ablyProvider.room.peerId);
              clearInterval(syncTimer);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);
      setSyncTimer(newTimer);
    }
  }, [player, leader]);

  useEffect(() => {
    if (!window.isYtScript) {
      var tag = document.createElement("script");

      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    let iframech = setInterval(() => {
      if (window.YT && !player && vidUrl) {
        if (syncTimer) {
          clearInterval(syncTimer);
        }
        if (!ytMap.has("url") || url != vidUrl) {
          ydoc.transact(() => {
            ytMap.set("url", vidUrl);
          });
        }

        addIframe();
        clearInterval(iframech);
      }
    }, 1000);
  }, [vidUrl]);

  useEffect(() => {
    const onDocChange = (e) => {
      console.log(ytMap.toJSON());
      if (ytMap.has("url")) {
        const url_ = ytMap.get("url");
        setVidUrl(url_);
      }
      if (ytMap.has("vidstate")) {
        const vidstate_ = ytMap.get("vidstate");
        setVidstate(vidstate_);
      }
      if (ytMap.has("current")) {
        const current_ = ytMap.get("current");
        setCurTime(current_);
      }
      if (ytMap.has("leader")) {
        const leader_ = ytMap.get("leader");
        setLeader(leader_);
      }
    };
    ytMap.observe(onDocChange);
    onDocChange();
    return () => ytMap.unobserve();
  }, []);

  return (
    <div className="w-full h-full">
      <div id={`${uid}_player`}>
        <div className="flex flex-col items-center justify-center h-full w-full">
          <svg
            aria-hidden="true"
            class="w-8 h-8 mr-2 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
            viewBox="0 0 100 101"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
              fill="currentFill"
            />
          </svg>{" "}
          <p className="text-gray-500">Loading video...</p>
        </div>
      </div>
    </div>
  );
}
