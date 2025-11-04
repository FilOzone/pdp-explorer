import { FileCode, Book, Calculator, Github, Menu, Server } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { NetworkSelector } from "./shared/NetworkSelector";
import { useState } from "react";
import { useNetwork } from "@/contexts/NetworkContext";

export default function PageHeader() {
    const { network } = useNetwork()
    const navigate = useNavigate()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    return (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between w-full sm:w-auto mb-4 sm:mb-0">
                <div className="flex items-center space-x-3" style={{ userSelect: 'none', cursor: 'pointer' }}
                    onClick={() => navigate('/')}
                >
                    <div className="bg-blue-600 text-white p-2 rounded-md">
                        <FileCode className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        PDP Scan
                    </h1>
                    {/* <button className="flex items-center space-x-1 px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors">
                        Old
                    </button> */}

                </div>
                {/* Mobile menu button */}
                <button
                    className="sm:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <Menu className="h-6 w-6" />
                </button>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-4 md:space-x-7">
                <Link
                    to={`https://pdpold.vxb.ai/${network}`}>
                    <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold text-[#4f46e5] border border-[#4f46e5] bg-transparent`}
                    >
                        2.x
                    </span>
                </Link>


                <Link
                    to={`/${network}/services`}
                    className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center"
                >
                    <Server className="h-4 w-4 mr-1" />
                    <span className="hidden md:inline">PDP Services</span>
                </Link>
                <Link
                    to="/documentation"
                    className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center"
                >
                    <Book className="h-4 w-4 mr-1" />
                    <span className="hidden md:inline">Docs</span>
                </Link>
                <Link
                    to="/gas-calculator"
                    className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center"
                >
                    <Calculator className="h-4 w-4 mr-1" />
                    <span className="hidden lg:inline">Gas Calculator</span>
                </Link>
                <Link
                    to="https://github.com/FilOzone/pdp-explorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gray-300 text-sm font-medium transition-colors flex items-center"
                    aria-label="GitHub Repository"
                >
                    <Github className="h-5 w-5" />{' '}
                    <span className="hidden lg:inline">GitHub</span>
                </Link>
                {/* Network Selector */}
                <NetworkSelector />
                {/* TODO: Fix colors to add this toggle ( default theme is light) */}
                {/* <ModeToggle />  */}
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
                <div className="sm:hidden w-full mt-4 space-y-3 border-t pt-3 dark:border-gray-700">
                    <Link
                        to={`https://pdpold.vxb.ai/${network}`}
                        className="block w-full text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    >
                        <FileCode className="h-4 w-4 mr-2" />
                        2.x
                    </Link>
                    <Link
                        to="/documentation"
                        className="block w-full text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    >
                        <Book className="h-4 w-4 mr-2" />
                        Docs
                    </Link>
                    <Link
                        to={`/${network}/services`}
                        className="block w-full text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    >
                        <Server className="h-4 w-4 mr-2" />
                        Services
                    </Link>
                    <Link
                        to="/gas-calculator"
                        className="block w-full text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 text-sm font-medium transition-colors flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    >
                        <Calculator className="h-4 w-4 mr-2" />
                        Gas Calculator
                    </Link>
                    <Link
                        to="https://github.com/FilOzone/pdp-explorer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gray-300 text-sm font-medium transition-colors flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                        aria-label="GitHub Repository"
                    >
                        <Github className="h-5 w-5 mr-2" /> GitHub
                    </Link>
                </div>
            )}
        </div>
    )
}