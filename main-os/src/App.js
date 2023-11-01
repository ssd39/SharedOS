import "./App.css";
import { useContext, useEffect, useMemo, useState } from "react";
import YAblyContext from "./y-ably/y-ably-context";
import * as Y from "yjs";
import {
  DndContext,
  MouseSensor,
  DragOverlay,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import { Grid } from "./Page/Grid";
import SortableContainer from "./Page/SortableContainer";
import { AblyProvider } from "./y-ably/y-ably";
import { ToastContainer } from "react-toastify";
import FloatingMenu from "./FloatingMenu";
import "react-toastify/dist/ReactToastify.css";
import Header from "./Header";
import randomColor from "randomcolor";
import Button from '@mui/joy/Button';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Modal from '@mui/joy/Modal';
import ModalDialog from '@mui/joy/ModalDialog';
import DialogTitle from '@mui/joy/DialogTitle';
import Stack from '@mui/joy/Stack';
import CursorBoard from "./CursorBoard";

const makeid = (length) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

const App = ({ uid, name, title, spaces }) => {
  const YAblyModule = useContext(YAblyContext);
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(MouseSensor));

  const color = useMemo(() => randomColor({luminosity:'dark'}));
  const [newYt, setNewYt] = useState(false)
  const [ytInput, setYtInput] = useState("")


  /**
   * @type {Y.Doc}
   */
  const ydoc = YAblyModule.ydoc;
  /**
   * @type {Y.Array}
   */
  const sortIndex = ydoc.getArray(`sortIndex_${uid}`);

  /**
   * @type {AblyProvider}
   */
  const ablyProvider = YAblyModule.ablyProvider;

  useEffect(() => {
    const onSortChange = (event) => {
      setItems((items) => {
        for (let newIndex = 0; newIndex < sortIndex.length; newIndex++) {
          const targetId = sortIndex.get(newIndex);
          console.log(targetId);
          const oldIndex = items.findIndex((item) => item.name === targetId);
          console.log(oldIndex, newIndex);
          if (oldIndex == -1) {
            items = [...items, { name: targetId, type: null }];
          } else if (oldIndex !== newIndex) {
            items = arrayMove(items, oldIndex, newIndex);
          }
        }
        return items;
      });
      console.log(sortIndex.toArray());
    };
    ablyProvider.on("synced", () => {});



    sortIndex.observe(onSortChange);
    onSortChange();
    return () => sortIndex.unobserve(onSortChange);
  }, []);

  const addApp = (e) => {
    let id = makeid(6);
    setItems((items) => {
      if(e.type == 'yt'){
        const url = e.url
        setYtInput("")
        return [...items, { name: id, type: e.type, url: url }];
      }else{
        return [...items, { name: id, type: e.type }];
      }
    });
    ydoc.transact(() => {
      sortIndex.push([id]);
    });
  }

  return (
    <div className="App">
      <CursorBoard uid={uid} spaces={spaces} name={name} memberColor={color} /> 
      <Header uid={uid} title={title} spaces={spaces} name={name} memberColor={color} />
      <FloatingMenu
        onAdd={(e) => {
          if(e.type == 'yt'){
            setNewYt(true)
          }else{
            addApp(e)
          }
        }}
      />

      <ToastContainer />
      <Grid columns={4}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items}>
            {items.map((data, index) => (
              <SortableContainer
                key={data.name}
                uid={data.name}
                url={data.url}
                index={index}
                type={data.type}
                userName={name}
                memberColor={color}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeId ? (
              <SortableContainer
                key={activeId}
                uid={activeId}
                url={
                  items[items.findIndex((item) => item.name === activeId)].url
                }
                type={
                  items[items.findIndex((item) => item.name === activeId)].type
                }
                index={items.findIndex((item) => item.name === activeId)}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </Grid>
      <Modal open={newYt} onClose={() => setNewYt(false)}>
        <ModalDialog>
          <DialogTitle>Youtube</DialogTitle>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setNewYt(false);
              addApp({ type: 'yt', url: ytInput })
            }}
          >
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Youtube Link?</FormLabel>
                <Input value={ytInput} onChange={e=> setYtInput(e.target.value)} autoFocus required />
              </FormControl>
              <Button type="submit">Add</Button>
            </Stack>
          </form>
        </ModalDialog>
      </Modal>
    </div>
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (over == null || active == null) {
      return;
    }
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.name === active.id);
        const newIndex = items.findIndex((item) => item.name === over.id);
        ydoc.transact(() => {
          sortIndex.delete(oldIndex);
          sortIndex.insert(newIndex, [active.id]);
        });
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  }
};

export default App;
