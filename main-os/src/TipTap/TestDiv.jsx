import React, { forwardRef, useContext } from "react";
import YAblyContext from "../y-ably/y-ably-context";
import TipTap from "../TipTap";
import * as Y from 'yjs'


export default forwardRef(
  ({   ...props }, ref) => {
    const YAblyModule = useContext(YAblyContext);


    /**
     * @type {Y.Doc}
     */
    const ydoc = YAblyModule.ydoc
   
    return (
      <TipTap name={props.userName} color={props.memberColor} changeFocus={props.changeFocus} ref={ref}  uid={props.uid} ydoc={ydoc} ablyProvider={YAblyModule.ablyProvider} />
      );
  }
);
