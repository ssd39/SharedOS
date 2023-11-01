import { useEffect } from "react";
import { useSpace, useMembers } from "@ably/spaces/react";

import Avatars from "./Avatars";


import styles from "./AvatarStack.module.css";

const AvatarStack = ({ name, memberColor }) => {
  /** 💡 Get a handle on a space instance 💡 */
  const { space } = useSpace();

  /** 💡 Enter the space as soon as it's available 💡 */
  useEffect(() => {
    console.log('On enter')
    space?.enter({ name, memberColor });
  }, [space]);

  /** 💡 Get everybody except the local member in the space and the local member 💡 */
  const { others, self } = useMembers();

  return (
    <div id="avatar-stack" className={`example-container ${styles.container}`}>
      {/** 💡 Stack of first 5 user avatars including yourself.💡 */}
      <Avatars self={self} otherUsers={others} />
    </div>
  );
};

export default AvatarStack;
