import { Action, Context } from '../events.js'
import { create_armor_stand } from '../armor_stand.js'
import logger from '../logger.js'
import { GameMode } from '../gamemode.js'
import ring_buffer from '../lib/ring_buffer.js'

const DAMAGE_INDICATORS_AMOUNT = 5
const DAMAGE_INDICATOR_TTL = 1200

const log = logger(import.meta)

/** @param {import('../context.js').InitialWorld} world */
export function register({ next_entity_id, ...world }) {
  return {
    ...world,
    damage_indicator_start_id: next_entity_id,
    next_entity_id: next_entity_id + DAMAGE_INDICATORS_AMOUNT,
  }
}

export default {
  /** @type {import('../context.js').Reducer} */
  reduce(state, { type, payload }) {
    if (type === Action.DAMAGE && state.game_mode !== GameMode.CREATIVE) {
      const { damage } = payload
      const health = Math.max(0, state.health - damage)

      log.info({ damage, health }, 'took damage')

      return {
        ...state,
        health,
      }
    }
    return state
  },

  /** @type {import('../context.js').Observer} */
  observe({ events, dispatch, client, world, signal }) {
    const buffer = ring_buffer({
      capacity: DAMAGE_INDICATORS_AMOUNT,
      max_age: DAMAGE_INDICATOR_TTL,
      on_eviction: entity_id => {
        client.write('entity_destroy', {
          entityIds: [entity_id],
        })
      },
    })

    events.on(Context.MOB_DAMAGE, ({ mob, damage }) => {
      const { damage_indicator_start_id } = world
      const entity_id = damage_indicator_start_id + buffer.cursor()
      const { x, y, z } = mob.position()
      const { height } = mob.constants

      const position = {
        x: x + (Math.random() * 2 - 1) * 0.25,
        y: y + height - 0.25 + (Math.random() * 2 - 1) * 0.15,
        z: z + (Math.random() * 2 - 1) * 0.25,
      }

      buffer.add(entity_id)

      create_armor_stand(client, entity_id, position, {
        text: `-${damage}`,
        color: '#E74C3C', // https://materialui.co/flatuicolors Alizarin
      })
    })
  },
}
