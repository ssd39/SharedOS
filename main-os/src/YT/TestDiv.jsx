import React, { forwardRef, useContext } from "react";
import YAblyContext from "../y-ably/y-ably-context";
import * as Y from 'yjs'
import YTApp from './index'

export default forwardRef(
  ({   ...props }, ref) => {
    const YAblyModule = useContext(YAblyContext);


    /**
     * @type {Y.Doc}
     */
    const ydoc = YAblyModule.ydoc
  //        <TipTap changeFocus={props.changeFocus} ref={ref}  uid={props.uid} ydoc={ydoc} ablyProvider={YAblyModule.ablyProvider} />

    return (
      <YTApp ydoc={ydoc} url={props.url} height={props.height} width={props.width}  uid={props.uid} ablyProvider={YAblyModule.ablyProvider}/>
    );
  }
);
