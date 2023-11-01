import React from "react";

export function Grid({ children, columns }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap:'wrap',
      }}
      className="m-4"
    >
      {children}
    </div>
  );
}