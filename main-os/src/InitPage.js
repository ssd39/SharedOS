import React, { useEffect, useMemo, useState } from "react";
import YAblyContext from "./y-ably/y-ably-context";
import App from "./App";
import * as Y from "yjs";
import { AblyProvider } from "./y-ably/y-ably";
import { toast } from "react-toastify";
import Spaces from "@ably/spaces";
import { useLocation } from "react-router-dom";

const parts = window.location.href.split("/");
const ydoc = new Y.Doc();
const ablyProvider = new AblyProvider(parts[parts.length-1] || 'test', ydoc);

export default function InitPage() {
  const [stage, setStage] = useState(0);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const parts = window.location.href.split("/");
  const [spaces, setSapces] = useState(null);
  const {state} = useLocation();

  ablyProvider.on("roomconnected", () => {
    const spaces_ = new Spaces(ablyProvider.room.ably);
    console.log(spaces_);
    setSapces(spaces_);
  });

  useEffect(() => {
    console.log(ablyProvider);
  }, [ablyProvider]);

  useEffect(() => {
    if (stage == 0) {
      fetch(`http://127.0.0.1:3001/space/${parts[parts.length - 1]}/${state?.title}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            if(state?.title){
              window.location.replace(window.location.href)
              return
            }
            setTitle(data.title);
            setStage(1);
          } else {
            toast.error(data.error, {
              position: "top-right",
              autoClose: 2500,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: "dark",
            });
          }
        })
        .catch((e) => {
          console.error(e);
          toast.error("Unable to call api!", {
            position: "top-right",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
          });
        });
    }
  }, []);

  return (
    <>
      {stage == 0 && (
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
      {stage == 1 && (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <div
            className="bg-white rounded-lg shadow-lg mt-12 w-24"
            style={{ padding: 20, width: "30%" }}
          >
            <h1 className="text-xl font-semibold" style={{ marginBottom: 25 }}>
              Your Name
            </h1>

            <div className="mb-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring focus:border-blue-400"
                placeholder="Enter something..."
              />
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 15,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => {
                  if (name == "") {
                    return toast.error("Name required!", {
                      position: "top-right",
                      autoClose: 1000,
                      hideProgressBar: false,
                      closeOnClick: true,
                      pauseOnHover: true,
                      draggable: true,
                      progress: undefined,
                      theme: "dark",
                    });
                  }
                  setStage(2);
                }}
                className=" bg-blue-500 hover:bg-blue-600 focus:ring focus:bg-blue-400 text-white font-semibold py-2 rounded-full transition duration-300"
                style={{ padding: 6, paddingTop: 3, paddingBottom: 3 }}
              >
                Let's Go
              </button>
            </div>
          </div>
        </div>
      )}
      {stage == 2 && (
        <YAblyContext.Provider
          value={{
            ydoc,
            ablyProvider,
          }}
        >
          <App spaces={spaces} uid={parts[parts.length - 1]} name={name} title={title} />
        </YAblyContext.Provider>
      )}
    </>
  );
}
