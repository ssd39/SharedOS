import { useMemo, useRef, useEffect } from "react";
import { useMembers, useSpace } from "@ably/spaces/react";
import { MemberCursors, YourCursor } from "./Cursors";
import styles from "./LiveCursors.module.css";

/** 💡 Select a mock name to assign randomly to a new user that enters the space💡 */

const LiveCursors = ({ name, userColors }) => {



  /** 💡 Get a handle on a space instance 💡 */
  const { space } = useSpace();

  useEffect(() => {
    console.log('live cursor space enter')
    space?.enter({ name, userColors });
  }, [space]);

  const { self } = useMembers();
  const liveCursors = useRef(null);

  return (
    <div
      id="live-cursors"
      ref={liveCursors}
      className={`example-container ${styles.liveCursorsContainer}`}
    >
      <YourCursor self={self} parentRef={liveCursors} />
      <MemberCursors />
    </div>
  );
};

export default LiveCursors;
