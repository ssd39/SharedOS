import React, { useState } from "react";
import { FaPlus } from "react-icons/fa";
const FloatingMenu = ({ onAdd = () => {} }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="fixed flex flex-col bottom-5 right-5 w-48"
      style={{ zIndex: 1001 }}
    >
      {menuOpen && (
        <div
          className=" mb-2 absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg"
          style={{ position: "relative" }}
        >
          <button
            onClick={() => {
              onAdd({ type: "yt" });
            }}
            className="block px-4 py-2 text-gray-800 hover:bg-gray-100 active:bg-gray-200 focus:outline-none transition duration-300 w-full text-left"
          >
            Add Youtube
          </button>
          <button
            onClick={() => {
              onAdd({ type: "note" });
            }}
            className="block px-4 py-2 text-gray-800 hover:bg-gray-100 active:bg-gray-200 focus:outline-none transition duration-300 w-full text-left"
          >
            Add Note
          </button>
          <button
            onClick={() => {
              onAdd({ type: "chart" });
            }}
            className="block px-4 py-2 text-gray-800 hover:bg-gray-100 active:bg-gray-200 focus:outline-none transition duration-300 w-full text-left"
          >
            Add Chart
          </button>
        </div>
      )}
      <div className="flex justify-end">
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded-full"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <FaPlus className="text-2xl" />
        </button>
      </div>
    </div>
  );
};

export default FloatingMenu;
