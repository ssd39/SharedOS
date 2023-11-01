import React, { useState, useEffect } from "react";
import { SpaceProvider, SpacesProvider } from "@ably/spaces/react";
import LiveCursors from "./vite-live-cursors/components/LiveCursors";
export default function CursorBoard({
  uid = "text",
  spaces,
  name,
  memberColor,
}) {
  const [showAS, setShowAS] = useState(false);
  useEffect(() => {
    if (spaces !== null) {
      console.log("got livecursor room space");
      setShowAS(true);
    }
  }, [spaces]);
  return (
    <div>
      {showAS && (
        <SpacesProvider client={spaces}>
          <SpaceProvider name={`${uid}_live-cursors`}>
            <LiveCursors name={name} userColors={{cursorColor:memberColor}} />
          </SpaceProvider>
        </SpacesProvider>
      )}
    </div>
  );
}
