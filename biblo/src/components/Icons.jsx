// Iconos de interfaz: Phosphor, peso "regular", en un solo sitio para
// mantener un trazo uniforme. El búho es el logotipo de Biblo, no un icono.
export {
  ShoppingBag as BagIcon,
  X as CloseIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  Check as CheckIcon,
  Eye as EyeIcon,
  BookOpen as OpenBookIcon,
  SpeakerHigh as SoundOnIcon,
  SpeakerSlash as SoundOffIcon,
} from '@phosphor-icons/react'

export function OwlIcon(props) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <circle cx="22" cy="27" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="42" cy="27" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="22" cy="27" r="2.6" fill="currentColor" />
      <circle cx="42" cy="27" r="2.6" fill="currentColor" />
      <path d="M31 30 L32 35 L33 30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 20 C14 12 20 8 32 8 C44 8 50 12 52 20" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M14 40 C20 46 44 46 50 40 C48 50 40 55 32 55 C24 55 16 50 14 40 Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  )
}
