export default function PageWrapper({ children }) {
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  )
}
