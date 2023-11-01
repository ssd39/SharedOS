import React, { useEffect, useRef, useState } from "react";
import { VegaLite } from "react-vega";
import * as Y from "yjs";
import { AblyProvider } from "../y-ably/y-ably";
import { toast } from "react-toastify";
/**
 *
 * @export
 * @param {Object} params
 * @param {Y.Doc} params.ydoc
 * @param {AblyProvider} params.ablyProvider
 * @return {*}
 */
export default ({ height, width, ydoc, uid, ablyProvider }) => {
  const [spec, setSpec] = useState({});

  const [isChart, setIsChart] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiLoading, setaiLoading] = useState(false);
  const [sqlquery, setSqlQuery] = useState("");
  const divRef = useRef();
  const vegaRef = useRef();
  const [cSize, setCSize] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (sqlquery) {
      fetch("http://127.0.0.1:8000/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sqlquery }),
      })
        .then((data) => data.json())
        .then((jData) => {
          if (jData.success) {
            setSpec((spec) => {
              spec.data = { values: jData.data };
              return spec;
            });
          }
        });
    }
  }, [sqlquery]);

  useEffect(() => {
    const { height, width } = divRef.current.getBoundingClientRect();

    setCSize({ x: width / 1.4, y: height / 1.4 });
  }, [height, width]);

  const vegaYmap = ydoc.getMap(uid);

  const callGptBackend = () => {
    fetch("http://127.0.0.1:8000/chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: prompt }),
    })
      .then((data) => data.json())
      .then((jData) => {
        if (jData.success) {
          ydoc.transact(() => {
            vegaYmap.set("isChart", true);
            vegaYmap.set("aiLoading", false);
            vegaYmap.set("spec", jData.spec);
            vegaYmap.set("query", jData.query);
          });
        } else {
          toast.error("Error while calling AI Engiene!", {
            position: "top-right",
            autoClose: 2500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
          });
          ydoc.transact(() => {
            vegaYmap.set("isChart", false);
            vegaYmap.set("aiLoading", false);
          });
        }
      })
      .catch((e) => {
        console.error(e);
        toast.error("Error while calling api!", {
          position: "top-right",
          autoClose: 2500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        ydoc.transact(() => {
          vegaYmap.set("isChart", false);
          vegaYmap.set("aiLoading", false);
        });
      });
  };

  useEffect(() => {
    const initHandle = () => {
      console.log(vegaYmap.toJSON());
      if (vegaYmap.has("isChart")) {
        const isChart_ = vegaYmap.get("isChart");
        setIsChart(isChart_);
      }
      if (vegaYmap.has("spec")) {
        const spec_ = vegaYmap.get("spec");
        setSpec(JSON.parse(JSON.stringify(spec_)));
      }
      if (vegaYmap.has("prompt")) {
        const prompt_ = vegaYmap.get("prompt");
        setPrompt(prompt_);
      }
      if (vegaYmap.has("aiLoading")) {
        const aiLoading_ = vegaYmap.get("aiLoading");
        setaiLoading(aiLoading_);
      }
      if (vegaYmap.has("query")) {
        const query_ = vegaYmap.get("query");
        setSqlQuery(query_);
      }
    };
    vegaYmap.observe(initHandle);
    initHandle()
    return () => vegaYmap.unobserve();
  }, []);
  return (
    <div ref={divRef} style={{ width: "100%", height: "100%", overflow:'auto' }}>
      {isChart && <VegaLite spec={spec} height={cSize.y} width={cSize.x} />}
      {!isChart && (
        <div className="relative flex items-center bg-gray-50 rounded-lg shadow-md p-3 mt-12">
          <input
            onChange={(e) => {
              setPrompt(e.target.value);
              ydoc.transact(() => {
                vegaYmap.set("prompt", e.target.value);
              });
            }}
            value={prompt}
            type="text"
            className="flex-1 outline-none focus:outline-none bg-gray-50 mr-2"
            placeholder="Enter your query"
            disabled={aiLoading}
          />
          <button
            onClick={() => {
              setaiLoading(true);
              ydoc.transact(() => {
                vegaYmap.set("aiLoading", true);
              });
              callGptBackend();
            }}
            disabled={aiLoading}
            className="whitespace-no-wrap bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold p-2 py-0.5 rounded"
          >
            Ask AI ✨
          </button>
        </div>
      )}

      {aiLoading && (
        <div className="flex flex-col items-center justify-center w-full mt-6">
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
          <p className="text-gray-500">AI Thinking...</p>
        </div>
      )}
    </div>
  );
};
