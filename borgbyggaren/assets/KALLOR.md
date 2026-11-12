# Källor till 3D-modellerna

Alla modeller är gjorda av Kay Lousberg (KayKit, www.kaylousberg.com) och har licensen
Creative Commons Zero (CC0 1.0, http://creativecommons.org/publicdomain/zero/1.0/).
Fritt att använda privat och kommersiellt, ingen namngivning krävs. Licensfilen ur varje paket ligger i `licenser/`.
Hämtade 2026-11-12 från GitHub-organisationen KayKit-Game-Assets (grenen main). Tony godkände nedladdningen samma dag.

| Paket | Källa | Licens | Mapp här |
|---|---|---|---|
| KayKit Character Pack: Adventurers 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 | `figurer/`, `vapen/` |
| KayKit Character Pack: Skeletons 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 | CC0 | `figurer/`, `vapen/` |
| KayKit Medieval Hexagon Pack 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 | CC0 | `hex/` |
| KayKit Dungeon Remastered 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0 | CC0 | `dungeon/` |
| KayKit Halloween Bits 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0 | CC0 | `gravplats/` |

## Filer som används

Varje `.gltf` har en `.bin` med samma namn bredvid sig (listas inte här).

**figurer/** (Adventurers och Skeletons): barbarian.glb, knight.glb, rogue.glb, skeleton_mage.glb, skeleton_minion.glb, skeleton_rogue.glb, skeleton_warrior.glb

Figurfilerna är bantade ur originalen (`Knight.glb`, `Barbarian.glb`, `Rogue.glb`, `Skeleton_Minion.glb`,
`Skeleton_Warrior.glb`, `Skeleton_Rogue.glb`, `Skeleton_Mage.glb`): nät, rigg och textur är orörda, men bara de
animationsklipp spelet behöver är kvar, och kanalerna för IK- och kontrollben samt skalning är borttagna.
Alla sju figurer har samma rigg. Klippen ligger i `knight.glb` (16 klipp, delas av äventyrarna) och
`skeleton_minion.glb` (17 klipp, delas av skeletten). Originalen var 3,5–4,9 MB styck, de bantade är 0,3–0,8 MB.

**vapen/** (Skeletons: Skeleton_*, Adventurers: arrow): Skeleton_Arrow.gltf, Skeleton_Axe.gltf, Skeleton_Blade.gltf, Skeleton_Shield_Large_A.gltf, Skeleton_Shield_Small_A.gltf, Skeleton_Staff.gltf, arrow.gltf, rogue_texture.png, skeleton_texture.png

**hex/** (Medieval Hexagon Pack, blå byggnader, neutrala murar, natur, rekvisita): barrel.gltf, building_archeryrange_blue.gltf, building_barracks_blue.gltf, building_blacksmith_blue.gltf, building_castle_blue.gltf, building_destroyed.gltf, building_home_A_blue.gltf, building_lumbermill_blue.gltf, building_mine_blue.gltf, building_scaffolding.gltf, building_tower_A_blue.gltf, building_tower_B_blue.gltf, building_tower_base_blue.gltf, crate_A_big.gltf, flag_blue.gltf, hexagons_medieval.png, resource_lumber.gltf, resource_stone.gltf, rock_single_A.gltf, rock_single_B.gltf, rock_single_C.gltf, rock_single_D.gltf, rock_single_E.gltf, sack.gltf, target.gltf, tent.gltf, tree_single_A.gltf, tree_single_A_cut.gltf, tree_single_B.gltf, tree_single_B_cut.gltf, wall_corner_A_outside.gltf, wall_straight.gltf, wall_straight_gate.gltf, weaponrack.gltf

**dungeon/** (Dungeon Remastered, originalens `*.gltf.glb` omdöpta till `*.glb`): coin.glb, coin_stack_small.glb, pillar.glb, rubble_large.glb, torch_lit.glb, torch_mounted.glb, wall_broken.glb

**gravplats/** (Halloween Bits): crypt.gltf, fence_broken.gltf, grave_A.gltf, grave_B.gltf, gravemarker_A.gltf, gravestone.gltf, halloweenbits_texture.png, lantern_standing.gltf, post_skull.gltf, skull.gltf, tree_dead_large.gltf, tree_dead_medium.gltf

**licenser/**: LICENSE_KayKit_Adventurers.txt, LICENSE_KayKit_Dungeon_Remastered.txt, LICENSE_KayKit_Halloween_Bits.txt, LICENSE_KayKit_Medieval_Hexagon_Pack.txt, LICENSE_KayKit_Skeletons.txt

Vilken fil som ritar vilken enhetstyp står i tabellerna `MODELLER` och `TYPER` överst i `grafik.js`.
Några filer ligger med som reserv och används inte än (till exempel `building_archeryrange_blue`, `building_scaffolding`,
`building_destroyed`, `wall_corner_A_outside`, `flag_blue`, `weaponrack`, `target`, `sack`, `torch_mounted`,
`coin_stack_small`, `rubble_large`, `skull`, `post_skull`, `fence_broken`, `lantern_standing`, `Skeleton_Arrow`).

