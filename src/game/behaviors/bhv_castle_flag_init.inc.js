import * as _Linker from "../../game/Linker"


export const bhv_castle_flag_init = () => {
    const o = gLinker.ObjectListProcessor.gCurrentObject
    o.header.gfx.unk38.animFrame = Math.floor(Math.random() * 28.0)
}


gLinker.bhv_castle_flag_init = bhv_castle_flag_init
