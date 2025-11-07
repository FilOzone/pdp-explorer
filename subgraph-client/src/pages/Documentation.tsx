import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import slugify from 'slugify'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FileText, Book } from 'lucide-react'
import GoBackLink from '@/components/go-back'

// Documentation structure
const docs = [
  {
    id: 'deployment',
    title: 'Subgraph Deployment',
    path: '/docs/subgraph/deployment.md',
  },
  {
    id: 'graphql-api',
    title: 'GraphQL API Reference',
    path: '/docs/subgraph/graphql-api.md',
  },
]

// Helper function to create slugs from heading text
const createSlug = (text: string) => {
  return slugify(text, { lower: true, strict: true })
}

export const Documentation = () => {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const selectedDoc = docs.find((doc) => doc.id === docId) || docs[0]

  // Effect to handle hash navigation after content loads
  useEffect(() => {
    if (!isLoading && window.location.hash) {
      const id = window.location.hash.substring(1)
      const element = document.getElementById(id)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    }
  }, [isLoading, content])

  useEffect(() => {
    const fetchDocContent = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch the markdown file
        const response = await fetch(selectedDoc.path)

        if (!response.ok) {
          throw new Error(
            `Failed to load documentation: ${response.statusText}`
          )
        }

        const text = await response.text()
        setContent(text)
      } catch (err) {
        console.error('Error loading documentation:', err)
        setError('Failed to load documentation. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocContent()
  }, [selectedDoc])

  // If no docId is provided, redirect to the first doc
  useEffect(() => {
    if (!docId && docs.length > 0) {
      navigate(`/documentation/${docs[0].id}`, { replace: true })
    }
  }, [docId, navigate])

  return (
     <div className="p-6 max-w-7xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <GoBackLink />
      </div>

      <div className="flex flex-col md:flex-row gap-8 relative">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0 md:sticky md:top-6 md:self-start">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Book className="h-5 w-5 mr-2 text-blue-600" />
              Documentation
            </h2>
            <nav className="space-y-1">
              {docs.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documentation/${doc.id}`}
                  className={`flex items-center px-3 py-2 text-sm rounded-md ${
                    doc.id === selectedDoc.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {doc.title}
                  {doc.id === selectedDoc.id && (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto" ref={contentRef}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            ) : error ? (
              <div className="text-red-500 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md">
                {error}
              </div>
            ) : (
              <article className="prose dark:prose-invert prose-blue max-w-none">
                <ReactMarkdown
                  rehypePlugins={[rehypeHighlight, rehypeRaw]}
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Add IDs to headings for anchor links
                    h1: ({ node, children, ...props }) => {
                      const id = createSlug(
                        String(children).replace(/\[|\]|`/g, '')
                      )
                      return (
                        <h1 id={id} {...props}>
                          {children}
                        </h1>
                      )
                    },
                    h2: ({ node, children, ...props }) => {
                      const id = createSlug(
                        String(children).replace(/\[|\]|`/g, '')
                      )
                      return (
                        <h2 id={id} {...props}>
                          {children}
                        </h2>
                      )
                    },
                    h3: ({ node, children, ...props }) => {
                      const id = createSlug(
                        String(children).replace(/\[|\]|`/g, '')
                      )
                      return (
                        <h3 id={id} {...props}>
                          {children}
                        </h3>
                      )
                    },
                    h4: ({ node, children, ...props }) => {
                      const id = createSlug(
                        String(children).replace(/\[|\]|`/g, '')
                      )
                      return (
                        <h4 id={id} {...props}>
                          {children}
                        </h4>
                      )
                    },
                    h5: ({ node, children, ...props }) => {
                      const id = createSlug(
                        String(children).replace(/\[|\]|`/g, '')
                      )
                      return (
                        <h5 id={id} {...props}>
                          {children}
                        </h5>
                      )
                    },
                    h6: ({ node, children, ...props }) => {
                      const id = createSlug(
                        String(children).replace(/\[|\]|`/g, '')
                      )
                      return (
                        <h6 id={id} {...props}>
                          {children}
                        </h6>
                      )
                    },
                    // Handle anchor links
                    a: ({ node, href, children, ...props }) => {
                      if (href?.startsWith('#')) {
                        return (
                          <a
                            href={href}
                            onClick={(e) => {
                              e.preventDefault()
                              const id = href.substring(1)
                              const element = document.getElementById(id)
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth' })
                                window.history.pushState(null, '', href)
                              }
                            }}
                            {...props}
                          >
                            {children}
                          </a>
                        )
                      }
                      return (
                        <a href={href} {...props}>
                          {children}
                        </a>
                      )
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
