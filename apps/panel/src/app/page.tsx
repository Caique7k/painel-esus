export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <div className="h-[20%] bg-blue-900 text-white flex items-center justify-center z-10 relative">Header</div>
      <div className="absolute inset-0 bg-blue-500 text-white pt-[20%] pb-[25%] flex items-center justify-center">Main</div>
      <div className="absolute bottom-0 w-full h-[25%] bg-blue-200/50 text-white flex items-center justify-center z-20 backdrop-blur-sm">Footer</div>
    </div>
  );
}
