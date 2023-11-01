import React, { forwardRef, useContext } from "react";
import YAblyContext from "../y-ably/y-ably-context";
import TipTap from "../TipTap";
import * as Y from 'yjs'
import VegaLite from './index'

export default forwardRef(
  ({   ...props }, ref) => {
    const YAblyModule = useContext(YAblyContext);


    /**
     * @type {Y.Doc}
     */
    const ydoc = YAblyModule.ydoc
  //        <TipTap changeFocus={props.changeFocus} ref={ref}  uid={props.uid} ydoc={ydoc} ablyProvider={YAblyModule.ablyProvider} />

    return (
      <VegaLite ydoc={ydoc} height={props.height} width={props.width}  uid={props.uid} ablyProvider={YAblyModule.ablyProvider}/>
    );
  }
);
