import { Context } from '../events.js'
import { write_bossbar, Colors, Divisions, Actions } from '../boss_bar.js'
import { Types } from '../mobs/types.js'
import logger from '../logger.js'
import lru_set from '../lib/lru_set.js'
import { to_rgb, to_hex, Formats } from '../chat.js'

const BOSS_BAR_AMOUNT = 3
const BOSS_BAR_TTL = 5000

const log = logger(import.meta)

// prismarine already parse UUIDs but let's stay clean
const format_uuid = entity_id =>
  `00000000-0bad-cafe-babe-${entity_id.toString().padStart(12, '0')}`

const mob_bar_color = ({ health, max_health }) => {
  const percent = (100 * health) / max_health
  if (percent > 65) return Colors.GREEN
  if (percent > 25) return Colors.YELLOW
  return Colors.RED
}

// those levels could be according to the player average damage ?
// or computed according to the floor strongest mob vs weakest
// we'll see
const mob_bar_division = ({ max_health }) => {
  if (max_health < 30) return Divisions.NOTCHES_NONE
  else if (max_health < 50) return Divisions.NOTCHES_6
  else if (max_health < 100) return Divisions.NOTCHES_10
  else if (max_health < 300) return Divisions.NOTCHES_12
  else return Divisions.NOTCHES_20
}

const format_title = ({
  displayName,
  level,
  health,
  max_health,
  entity_id,
}) => [
  {
    text: displayName,
  },
  {
    text: ` [Lvl ${level}] `,
    color: '#C0392B', // https://materialui.co/flatuicolors #pomegranate
  },
  {
    text: '(',
  },
  {
    text: health,
    color: to_hex(to_rgb((100 * health) / max_health)),
  },
  {
    text: '/',
  },
  {
    text: max_health,
    ...Formats.SUCCESS,
  },
  {
    text: ')',
  },
  {
    text: ` (${entity_id})`,
    color: '#03A9F4',
    bold: true,
    underline: true,
  },
]

export default {
  /** @type {import('../context.js').Observer} */
  observe({ events, dispatch, client, world, signal }) {
    const cache = lru_set({
      capacity: BOSS_BAR_AMOUNT,
      max_age: BOSS_BAR_TTL,
      on_eviction: entityUUID =>
        write_bossbar({
          client,
          entityUUID,
          action: Actions.REMOVE,
        }),
    })

    events.on(Context.MOB_DAMAGE, ({ mob, damage }) => {
      const {
        displayName,
        health: max_health = 20,
        // TODO: we have work to do on json files
        // the level should be here but isn't yet
        // for the sake of this feature i need it here and will later remove the default value
        level = 1,
      } = Types[mob.mob]
      const { health } = mob.get_state()
      const entityUUID = format_uuid(mob.entity_id)
      const display_health = Math.max(0, Math.min(1, health / max_health))
      const color = mob_bar_color({ health, max_health })
      const title = format_title({
        displayName,
        level,
        health,
        max_health,
        entity_id: mob.entity_id,
      })

      if (cache.access(entityUUID)) {
        write_bossbar({
          client,
          entityUUID,
          action: Actions.UPDATE_HEALTH,
          health: display_health,
        })
        write_bossbar({
          client,
          entityUUID,
          action: Actions.UPDATE_STYLE,
          color,
        })
        write_bossbar({
          client,
          entityUUID,
          action: Actions.UPDATE_TITLE,
          title,
        })
      } else {
        log.info({ display_health, entityUUID }, 'create bossbar')
        cache.add(entityUUID)
        write_bossbar({
          client,
          entityUUID,
          title,
          color,
          health: display_health,
          dividers: mob_bar_division({ max_health }),
        })
      }
    })
  },
}
