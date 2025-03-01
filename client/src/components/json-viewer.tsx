import JsonView from '@uiw/react-json-view'
import { githubLightTheme } from '@uiw/react-json-view/githubLight'

const JsonDisplay = ({ jsonData }) => {
  return <JsonView value={jsonData} collapsed={0} style={githubLightTheme} />
}

export default JsonDisplay
