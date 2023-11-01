import { useState, FunctionComponent } from "react";

import useClickOutsideList from "../hooks/useClickOutsideList";
import UserInfo from "./UserInfo";
import { MAX_USERS_BEFORE_LIST } from '../utils/helpers'
import styles from "./Surplus.module.css";

const Surplus= ({
  otherUsers,
}) => {
  const [showList, setShowList] = useState(false);
  const { listRef, plusButtonRef } = useClickOutsideList(() =>
    setShowList(false),
  );

  return otherUsers.length > MAX_USERS_BEFORE_LIST ? (
    <div className={styles.container}>
      <div
        className={styles.badge}
        style={{
          zIndex: otherUsers.length + 50,
        }}
        ref={plusButtonRef}
        onClick={() => {
          setShowList(!showList);
        }}
      >
        +{otherUsers.slice(MAX_USERS_BEFORE_LIST).length}
      </div>

      {showList ? (
        <div className={styles.list} ref={listRef}>
          {otherUsers.slice(MAX_USERS_BEFORE_LIST).map((user) => (
            <div className={styles.user} key={user.clientId}>
              <UserInfo user={user} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;
};

export default Surplus;
