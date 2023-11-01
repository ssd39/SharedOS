import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { uuidv4 } from "lib0/random";
import "./Main.css";
import { useNavigate } from "react-router-dom";

const txtFull = [
  " Whether it's business or entertainment, SharedOS offers limitless possibilities.",
  "Leverage AI to generate valuable insights and data-driven reports.",
  "Collaborate with your team in real-time, making work effortless and efficient.",
]; //the text goes here
let ic = 0;

export default () => {
  const [isStarted, setIsStarted] = useState(false);
  const [isEnd, setIsEnd] = useState(false);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  function getRandomTime() {
    return Math.random() * 0.2;
  }
  function getEle(id) {
    return document.getElementById("text");
  }
  function ModifyTxt(el, txt) {
    return (el.innerHTML = txt);
  }
  const writeOut = (txtArr, curChar = 0) => {
    const randomTime = getRandomTime();
    let meto = setTimeout(
      () => {
        try {
          if (isEnd) {
            clearTimeout(meto);
            return;
          }
          const el = getEle("text");
          let elTxt = el.innerHTML;
          elTxt += txtArr[curChar];
          ModifyTxt(el, elTxt);
          //check if next iteration is out of range
          if (curChar + 1 == txtArr.length) {
            return deleteOut(txtArr, txtArr.length);
          }
          return writeOut(txtArr, curChar + 1);
        } catch (e) {}
      },

      randomTime * 1000
    );
  };
  const deleteOut = (txtArr, curChar = 0) => {
    const randomTime = getRandomTime();
    let meto = setTimeout(
      () => {
        try {
          if (isEnd) {
            clearTimeout(meto);
            return;
          }
          const el = getEle("text");
          let elTxt = el.innerHTML;
          //remove
          const elTxtArr = elTxt.split("");
          const elTxtArrLen = elTxtArr.length;
          const newElTxt = elTxtArr.splice(0, curChar - 1).join("");
          ModifyTxt(el, newElTxt);
          console.log(elTxtArrLen);
          if (elTxtArrLen <= 0) {
            ic = (ic + 1) % 3;
            console.log("hey listen");
            return writeOut(txtFull[ic].split(""), 0);
          }
          return deleteOut(txtArr, elTxtArrLen - 1);
        } catch (e) {}
      },

      randomTime * 1000
    );
    return;
  };

  useEffect(() => {
    if (!isStarted) {
      setIsStarted(true);
      writeOut(txtFull[0].split(""));
    }
  }, [isStarted]);

  return (
    <div>
      <div
        className="bg-black flex flex-col"
        style={{ width: "100%", height: "100vh" }}
      >
        <div
          className="flex-1 flex  flex-col"
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <h1 className="neonText flicker-text">SharedOS</h1>

          <div style={{ marginTop: 170, width: "auto", position: "relative" }}>
            <div
              className="collaboration-cursor__label"
              style={{ left: "100%", marginLeft: -5, fontSize: 22 }}
            >
              AI
            </div>
            <h2 className="subtext" id="text"></h2>
          </div>

          <div style={{ marginTop: 32 }}>
            <div className="relative flex items-center bg-gray-50 rounded-lg shadow-md p-3 mt-12">
              <input
                onChange={(e) => {
                  setName(e.target.value);
                }}
                type="text"
                value={name}
                className="flex-1 outline-none focus:outline-none bg-gray-50 mr-2"
                placeholder="Your os name"
              />
              <button
                onClick={() => {
                  if (name != "") {
                    setIsEnd(true);
                    navigate(`/space/${uuidv4()}`, { state: { title: name } });
                  } else {
                    toast.error("OS name required to continue!", {
                      position: "top-right",
                      autoClose: 1500,
                      hideProgressBar: false,
                      closeOnClick: true,
                      pauseOnHover: true,
                      draggable: true,
                      progress: undefined,
                      theme: "dark",
                    });
                  }
                }}
                className="whitespace-no-wrap bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold p-2 py-0.5 rounded"
              >
                Login 🌎
              </button>
            </div>
          </div>
        </div>
        <div
          className="flex mb-3"
          style={{ justifyContent: "center", alignItems: "center" }}
        >
          <span className="text-white">
            V1.0 (Powered By Ably, YJs, OpenAI)
          </span>
        </div>
      </div>
    </div>
  );
};
