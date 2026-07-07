import type { House } from '../App'
import gryffindor from '../assets/houses/gryffindor.png'
import hufflepuff from '../assets/houses/hufflepuff.png'
import ravenclaw from '../assets/houses/ravenclaw.png'
import slytherin from '../assets/houses/slytherin.png'

type NamedHouse = Exclude<House, 'none'>

const HOUSE_LABEL: Record<NamedHouse, string> = {
  gryffindor: 'Gryffindor',
  hufflepuff: 'Hufflepuff',
  ravenclaw: 'Ravenclaw',
  slytherin: 'Slytherin',
}

const HOUSE_CREST: Record<NamedHouse, string> = {
  gryffindor,
  hufflepuff,
  ravenclaw,
  slytherin,
}

type Props = {
  house: NamedHouse
  /** Rendered pixel size (square). */
  size?: number
  className?: string
  /** True when a nearby label already names the house (hides it from a11y tree). */
  decorative?: boolean
}

export default function HouseSigil({ house, size = 24, className, decorative = false }: Props) {
  return (
    <img
      src={HOUSE_CREST[house]}
      width={size}
      height={size}
      className={className}
      alt={decorative ? '' : `${HOUSE_LABEL[house]}-emblem`}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}
