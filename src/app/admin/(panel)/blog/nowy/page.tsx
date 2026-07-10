import { BlogForm } from "@/components/admin/BlogForm";

export default function NowyPostPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">Nowy post</h1>
      <div className="card mt-6 p-6">
        <BlogForm />
      </div>
    </div>
  );
}
