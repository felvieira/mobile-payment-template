interface Props {
  env: string
}

export function EnvBadge({ env }: Props) {
  const colors: Record<string, string> = {
    qa: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    prod: 'bg-red-100 text-red-800 border-red-200',
    test: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    live: 'bg-red-100 text-red-800 border-red-200',
    dev: 'bg-blue-100 text-blue-800 border-blue-200',
    'tauri-only': 'bg-purple-100 text-purple-800 border-purple-200',
  }
  return (
    <span
      className={`text-xs font-mono px-2 py-0.5 rounded-full border font-medium ${
        colors[env] ?? 'bg-gray-100 text-gray-700 border-gray-200'
      }`}
    >
      {env}
    </span>
  )
}
