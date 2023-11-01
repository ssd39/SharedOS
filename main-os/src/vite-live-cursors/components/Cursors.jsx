import React, { useState } from "react";
import { useCursors } from "@ably/spaces/react";
import CursorSvg from "./CursorSvg";
import useTrackCursor from "../hooks/useTrackCursor";


import styles from "./Cursors.module.css";

// 💡 This component is used to render the cursor of the user
const YourCursor = ({
  self,
  parentRef,
}) => {
  const [cursorPosition, setCursorPosition] = useState({ left: 0, top: 0, state: "move" });
  const handleSelfCursorMove = useTrackCursor(setCursorPosition, parentRef);
  if (!self) {
    return null;
  }
  if (cursorPosition.state === "leave") return null;
  //const { cursorColor } = self.profileData.userColors;
  //console.log(cursorColor)
  return (
    <></>
  );
};



// 💡 This component is used to render the cursors of other users in the space
const MemberCursors = () => {
  const { cursors } = useCursors({ returnCursors: true });

  return (
    <>
      {Object.values(cursors).map((data) => {
        const cursorUpdate = data.cursorUpdate;
        const member = data.member;
        if (cursorUpdate.data.state === "leave"){
          return;
        } 

        const { cursorColor } = member.profileData.userColors;
        return (
          <div
            key={member.connectionId}
            id={`member-cursor-${member.connectionId}`}
            className={styles.cursor}
            style={{
              left: `${cursorUpdate.position.x}px`,
              top: `${cursorUpdate.position.y}px`,
            }}
          >
            <CursorSvg cursorColor={cursorColor} />
            <div
              style={{ backgroundColor: cursorColor }}
              className={`${styles.cursorName} member-cursor`}
            >
              {member.profileData.name}
            </div>
          </div>
        );
      })}
    </>
  );
};

export { MemberCursors, YourCursor };
