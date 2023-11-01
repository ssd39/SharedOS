import React, { useEffect, useState } from "react";
import { FaLink } from "react-icons/fa";
import Spaces from "@ably/spaces";
import { SpaceProvider, SpacesProvider } from "@ably/spaces/react";
import AvatarStack from "./vite-avatar-stack/components/AvatarStack";
import { Tooltip } from "@mui/joy";
import { toast } from "react-toastify";
import CommunicationManager from "./Agora/CommunicationManager";

/**
 *
 * @param {Object} param0
 * @param {Array} param0.users
 * @param {Spaces} param0.users
 * @returns
 */
const Header = ({ uid = "text", title, spaces, name, memberColor }) => {
  const [showAS, setShowAS] = useState(false);
  useEffect(() => {
    if (spaces !== null) {
      console.log("got room space");
      setShowAS(true);
    }
  }, [spaces]);
  return (
    <div className=" p-4 py-6 flex justify-between items-center m-2 rounded headercolor">
      <div className="flex items-center p-3">
        <Tooltip title="Share Report">
          <button
            onClick={() => {
              const textArea = document.createElement("textarea");
              textArea.value = window.location.href;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand("copy");
              document.body.removeChild(textArea);
              toast.success("Link copied!", {
                position: "top-right",
                autoClose: 1000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
              });
            }}
            className="bg-white rounded-full p-2 shadow-md hover:bg-gray-100 transform hover:scale-110 transition-transform active:bg-blue-300"
          >
            <FaLink className="text-blue-500" size={20} />
          </button>
        </Tooltip>
        <h1
          className="text-white text-2xl font-bold"
          style={{ marginLeft: 12 }}
        >
          {title}
        </h1>
      </div>
      <div className="flex-1"></div>
      <div className="flex" style={{ marginRight: 25 }}>
        <CommunicationManager channel_name={uid} />
        {showAS && (
          <SpacesProvider client={spaces}>
            <SpaceProvider name={`${uid}_avatar-stack`}>
              <AvatarStack name={name} memberColor={memberColor} />
            </SpaceProvider>
          </SpacesProvider>
        )}
      </div>
    </div>
  );
};

export default Header;
