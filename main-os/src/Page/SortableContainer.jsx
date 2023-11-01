import React, { useEffect, useState, useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaGripLines, FaExpandArrowsAlt } from "react-icons/fa";
import * as Y from "yjs";
import YAblyContext from "../y-ably/y-ably-context";
import TestDiv from "../VegaLite/TestDiv";
import TestDiv1 from "../TipTap/TestDiv";
import TestDiv2 from "../YT/TestDiv";

export default (props) => {
  const sortable = useSortable({ id: props.uid });
  const {
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
    attributes,
  } = sortable;
  const [type_, setType_] = useState(props.type);
  const YAblyModule = useContext(YAblyContext);
  const initHeights = {
    chart: { x: 400, y: 500 },
    yt: { x: 800, y: 500 },
    note: { x: 400, y: 300 },
  };
  /**
   * @type {AblyProvider}
   */
  const ablyProvider = YAblyModule.ablyProvider;

  /**
   * @type {Y.Doc}
   */
  const ydoc = YAblyModule.ydoc;
  /**
   * @type {Y.Map}
   */
  const containerYProps = ydoc.getMap(`srcontainer_${props.uid}`);
  const [size, setSize] = useState(
    initHeights[props.type] || { x: 400, y: 300 }
  );

  const handler = (mouseDownEvent) => {
    const startSize = size;
    const startPosition = { x: mouseDownEvent.pageX, y: mouseDownEvent.pageY };
    let newSize = startSize;
    function onMouseMove(mouseMoveEvent) {
      setSize((currentSize) => {
        newSize = {
          x: startSize.x - startPosition.x + mouseMoveEvent.pageX,
          y: startSize.y - startPosition.y + mouseMoveEvent.pageY,
        };
        return newSize;
      });
    }
    const onMouseUp = () => {
      ydoc.transact(() => {
        console.log("my size", newSize);
        containerYProps.set("size_", newSize);
      });
      document.body.removeEventListener("mousemove", onMouseMove);
      // uncomment the following line if not using `{ once: true }`
      // document.body.removeEventListener("mouseup", onMouseUp);
    };

    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp, { once: true });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,

    opacity: listeners.faded ? "0.2" : "1",
    transformOrigin: "0 0",
    zIndex: isDragging ? "901" : "auto",
    opacity: isDragging ? 0.3 : 1,
  };

  const [isFocus, setFocus] = useState(false);
  useEffect(() => {
    console.log(props.url);
    /**
     *
     * @param {Y.YMapEvent} e
     */
    const handleIntiSync = (e) => {
      if (containerYProps.has("size_")) {
        const newSize = containerYProps.get("size_");
        setSize(newSize);
      }
      if (containerYProps.has("type_")) {
        if (e?.transaction?.origin != null || e === undefined) {
          const type__ = containerYProps.get("type_");
          setType_(type__);
        }
      }
    };
    containerYProps.observe(handleIntiSync);
    handleIntiSync();
    return () => containerYProps.unobserve();
  }, []);

  useEffect(() => {
    if (props.type) {
      ydoc.transact(() => {
        containerYProps.set("type_", props.type);
      });
    }
  }, [props.type]);

  return (
    <div
      style={{
        ...style,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: size.x,
        height: size.y,
      }}
      className="bg-white rounded-xl shadow-lg m-2"
      ref={setNodeRef}
    >
      {!isFocus && (
        <div
          className="p-2 px-5"
          style={{
            zIndex: 900,
            position: "absolute",
            right: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
          }}
        >
          <button
            {...listeners}
            {...attributes}
            className="rounded-full bg-gray-50 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 text-gray-800 px-2 py-2 flex items-center space-x-2  shadow-inner"
          >
            <div className="cursor-pointer">
              <FaGripLines className="text-base" />
            </div>
          </button>
        </div>
      )}
      {!type_ && (
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
          <p className="text-gray-500">Syncing</p>
        </div>
      )}
      {type_ == "chart" && (
        <div style={{ flex: 1 }}>
          <TestDiv
            changeFocus={(val) => setFocus(val)}
            {...props}
            height={size.x}
            width={size.y}
          />
        </div>
      )}
      {type_ == "note" && (
        <div style={{ flex: 1 }}>
          <TestDiv1
            changeFocus={(val) => setFocus(val)}
            {...props}
            height={size.x}
            width={size.y}
          />
        </div>
      )}
      {type_ == "yt" && (
        <div style={{ flex: 1 }}>
          <TestDiv2
            changeFocus={(val) => setFocus(val)}
            {...props}
            height={size.x}
            width={size.y}
          />
        </div>
      )}
      <div
        className="py-1.5 px-2"
        style={{
          zIndex: 900,
          position: "absolute",
          bottom: 0,
          right: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
        }}
      >
        <button
          id="draghandle"
          type="button"
          onMouseDown={handler}
          className="rounded-full bg-gray-50 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 text-gray-800 px-2 py-2 flex items-center space-x-2  shadow-inner"
        >
          <div className="cursor-pointer">
            <FaExpandArrowsAlt className="text-base" />
          </div>
        </button>
      </div>
    </div>
  );
};
