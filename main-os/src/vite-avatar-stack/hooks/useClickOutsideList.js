import { useEffect, useRef } from "react";

const useClickOutsideList = (callback) => {
  const listRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLDivElement>(null);

  // 💡 Handler to click outside user list
  useEffect(() => {
    const listener = (event) => {
      if (
        !listRef.current ||
        listRef.current.contains(event.target) ||
        !plusButtonRef.current ||
        plusButtonRef.current.contains(event.target)
      ) {
        return;
      }

      callback();
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [listRef, plusButtonRef]);

  return { listRef, plusButtonRef };
};

export default useClickOutsideList;
