import JsonView from '@uiw/react-json-view'
import { githubLightTheme } from '@uiw/react-json-view/githubLight'
import { githubDarkTheme } from '@uiw/react-json-view/githubDark'
import { useTheme } from '@/components/shared/ThemeProvider'

const JsonDisplay = ({ jsonData }) => {
  const { theme } = useTheme()
  return (
    <JsonView
      value={jsonData}
      collapsed={0}
      style={theme === 'dark' ? githubDarkTheme : githubLightTheme}
    />
  )
}

export default JsonDisplay
