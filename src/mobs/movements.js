import { on } from 'events'

import { aiter } from 'iterator-helper'
import Vec3 from 'vec3'

import { chunk_position, chunk_index } from '../chunk.js'
import { direction_to_yaw_pitch } from '../math.js'
import { position_equal } from '../position.js'
import { abortable } from '../iterator.js'
import { PlayerEvent } from '../events.js'

import { despawn_mobs, spawn_mob } from './spawn.js'

export default {
  /** @type {import('../context.js').Observer} */
  observe({ client, events, world, inside_view }) {
    events.on(PlayerEvent.CHUNK_LOADED_WITH_MOBS, ({ x, z, signal }) => {
      aiter(
        abortable(on(world.mobs.positions, chunk_index(x, z), { signal }))
      ).forEach(([{ mob, position, last_position, target }]) => {
        if (inside_view(position) && !inside_view(last_position)) {
          // Mob entered view
          spawn_mob(client, { mob, position, events })
        } else if (!inside_view(position) && inside_view(last_position)) {
          // Mob exited view
          despawn_mobs(client, {
            ids: [mob.entity_id],
            events,
          })
        } else {
          // Mob moved in view
          const chunk_x = chunk_position(position.x)
          const chunk_z = chunk_position(position.z)

          if (chunk_x === x && chunk_z === z) {
            const { yaw: headYaw, pitch } = direction_to_yaw_pitch(
              Vec3(target).subtract(Vec3(position))
            )

            const { yaw } = direction_to_yaw_pitch(
              Vec3(position).subtract(Vec3(last_position))
            )

            if (
              Math.abs(position.x - last_position.x) >= 8 ||
              Math.abs(position.y - last_position.y) >= 8 ||
              Math.abs(position.z - last_position.z) >= 8
            ) {
              client.write('entity_teleport', {
                entityId: mob.entity_id,
                ...position,
                yaw,
                pitch,
                onGround: true,
              })
            } else {
              const delta_x = (position.x * 32 - last_position.x * 32) * 128
              const delta_y = (position.y * 32 - last_position.y * 32) * 128
              const delta_z = (position.z * 32 - last_position.z * 32) * 128

              client.write('entity_move_look', {
                entityId: mob.entity_id,
                dX: delta_x,
                dY: delta_y,
                dZ: delta_z,
                yaw,
                pitch,
                onGround: true,
              })
            }

            if (!position_equal(target, position)) {
              client.write('entity_head_rotation', {
                entityId: mob.entity_id,
                headYaw,
              })
            }
          }
        }
      })
    })
  },
}
